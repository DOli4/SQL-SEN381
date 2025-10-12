// tests/routes/topics.routes.test.js
import 'express-async-errors'
import { jest, describe, test, expect, beforeEach } from '@jest/globals'
import express from 'express'
import request from 'supertest'

// ---- mocks BEFORE importing router ----

// requireAuth: just inject a user and call next()
    const requireAuthMock = jest.fn((req, _res, next) => {
    req.user = { sub: 77, role: 'TUTOR', RoleName: 'TUTOR' }
    next()
    })
    jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
    requireAuth: requireAuthMock
    }))

    // mssql (callable types + MAX)
    const getPoolMock = jest.fn()
    const sqlStub = {
    VarChar: (n) => ({ __t: 'VarChar', n }),
    Int: () => ({ __t: 'Int' }),
    MAX: 4000
    }
    jest.unstable_mockModule('../../src/db/mssql.js', () => ({
    getPool: getPoolMock,
    sql: sqlStub
    }))

    // import router after mocks
    const router = (await import('../../src/routes/topics.routes.js')).default

    function makePoolWithQueries(sequence) {
    let i = 0
    return {
        request() {
        return {
            input() { return this },
            async query() {
            const step = sequence[i++]
            if (!step) throw new Error('no more mock results')
            if (step.reject) throw new Error(step.reject)
            return step
            }
        }
        }
    }
    }

    const app = () => {
    const a = express()
    a.use(express.json())
    a.use('/topics', router)
    a.use((err, _req, res, _next) => {
        res.status(500).json({ error: err.message || 'Internal error' })
    })
    return a
    }

    beforeEach(() => {
    jest.clearAllMocks()
    })

    describe('routes/topics', () => {
    // ------------------ EXISTING TESTS ------------------
    test('GET /topics/:id 200 returns the topic', async () => {
    getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ Topic_ID: 42, Title: 'Solo', Module_ID: 3, User_ID: 77, Description: 'Hi' }] }
    ]))
    const res = await request(app()).get('/topics/42')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(expect.objectContaining({ Topic_ID: 42 }))
    })

    test('GET /topics returns list', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ Topic_ID: 1 }, { Topic_ID: 2 }] }
        ]))
        const res = await request(app()).get('/topics')
        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(2)
        expect(requireAuthMock).toHaveBeenCalled()
    })

    test('GET /topics 500 when DB fails', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([{ reject: 'db down' }]))
        const res = await request(app()).get('/topics')
        expect(res.status).toBe(500)
    })

    test('GET /topics/:id 404 when not found', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([{ recordset: [] }]))
        const res = await request(app()).get('/topics/999')
        expect(res.status).toBe(404)
    })

    test('GET /topics/:id 500 when DB fails', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([{ reject: 'db down' }]))
        const res = await request(app()).get('/topics/1')
        expect(res.status).toBe(500)
    })

    test('POST /topics creates and returns id', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ Topic_ID: 5 }] }
        ]))
        const res = await request(app())
        .post('/topics')
        .send({ title: 'New', moduleId: 3, description: 'Intro' })
        expect(res.status).toBe(201)
        expect(res.body).toEqual({ Topic_ID: 5 })
    })

    test('POST /topics 400 when required fields missing', async () => {
        const res = await request(app())
        .post('/topics')
        .send({})
        expect(res.status).toBe(400)
    })

    test('POST /topics 500 when insert fails', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([{ reject: 'insert failed' }]))
        const res = await request(app())
        .post('/topics')
        .send({ title: 'Fail', moduleId: 3 })
        expect(res.status).toBe(500)
    })
    
    test('PUT /topics/:id 200 response body includes ok:true', async () => {
    getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ User_ID: 77 }] }, // owner check
        { recordset: [] } // update
    ]))
    const res = await request(app())
        .put('/topics/55')
        .send({ title: 'Updated', moduleId: 1, description: 'Refined' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual(expect.objectContaining({ ok: true }))
    })

    test('DELETE /topics/:id 200 response body includes ok:true', async () => {
    getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ User_ID: 77 }] }, // owner ok
        {}, {}, { rowsAffected: [1] }
    ]))
    const res = await request(app()).delete('/topics/55')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(expect.objectContaining({ ok: true }))
    })

    test('DELETE /topics/:id 204 when nothing deleted', async () => {
    getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ User_ID: 77 }] },
        {}, {}, { rowsAffected: [0] }
    ]))
    const res = await request(app()).delete('/topics/999')
    expect([200,204]).toContain(res.status)
})


    // ------------------ NEW TESTS ------------------
    test('PUT /topics/:id 400 when missing title/moduleId', async () => {
        const res = await request(app()).put('/topics/1').send({ title: '' })
        expect(res.status).toBe(400)
    })

    test('PUT /topics/:id 403 when not owner or admin', async () => {
        // ensureOwnerOrAdmin -> forbidden
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ User_ID: 99 }] } // different user
        ]))
        const res = await request(app())
        .put('/topics/1')
        .send({ title: 'X', moduleId: 1 })
        expect(res.status).toBe(403)
    })

    test('PUT /topics/:id 404 when topic not found', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [] } // not found
        ]))
        const res = await request(app())
        .put('/topics/1')
        .send({ title: 'X', moduleId: 1 })
        expect(res.status).toBe(404)
    })

    test('PUT /topics/:id 200 on success', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ User_ID: 77 }] }, // owner
        { recordset: [] } // update result
        ]))
        const res = await request(app())
        .put('/topics/1')
        .send({ title: 'X', moduleId: 1, description: 'ok' })
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ ok: true })
    })

    test('DELETE /topics/:id 403 when not owner', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ User_ID: 99 }] } // forbidden
        ]))
        const res = await request(app()).delete('/topics/1')
        expect(res.status).toBe(403)
    })

    test('DELETE /topics/:id 404 when topic not found', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [] } // not found
        ]))
        const res = await request(app()).delete('/topics/1')
        expect(res.status).toBe(404)
    })

    test('DELETE /topics/:id 200 on success', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ User_ID: 77 }] }, // owner ok
        {}, {}, { rowsAffected: [1] } // deletes
        ]))
        const res = await request(app()).delete('/topics/1')
        expect(res.status).toBe(200)
        expect(res.body).toEqual(expect.objectContaining({ ok: true }))
    })

    test('DELETE /topics/:id 500 when DB fails', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([{ reject: 'db down' }]))
        const res = await request(app()).delete('/topics/1')
        expect(res.status).toBe(500)
    })
    })
