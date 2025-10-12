// tests/controllers/auth.controller.test.js
import { jest, describe, test, expect, beforeEach } from '@jest/globals'
import express from 'express'
import request from 'supertest'

/* =========================
    Mocks (define BEFORE SUT)
    ========================= */

    // mssql: controller imports { getPool, sql }
    const getPoolMock = jest.fn()
    const sqlStub = {
    VarChar: (len) => ({ __type: 'VarChar', len }),
    NVarChar: (len) => ({ __type: 'NVarChar', len }),
    Int: () => ({ __type: 'Int' }),
    Date: () => ({ __type: 'Date' }),
    DateTime: () => ({ __type: 'DateTime' })
}
    jest.unstable_mockModule('../../src/db/mssql.js', () => ({
    getPool: getPoolMock,
    sql: sqlStub
    }))

    // bcryptjs: controller compares and hashes
    const hashMock = jest.fn(async () => 'hashed!')
    const compareMock = jest.fn(async () => true)

    jest.unstable_mockModule('bcryptjs', () => ({
    default: { hash: hashMock, compare: compareMock },
    hash: hashMock,
    compare: compareMock
    }))

    // jwt util: controller calls signUser(user)
    const signUserMock = jest.fn(() => 'stub.jwt.token')

    jest.unstable_mockModule('../../src/utils/jwt.js', () => ({
    signUser: signUserMock
    }))

    /* =========================
    Import SUT after mocks
    ========================= */
    const auth = await import('../../src/controllers/auth.controller.js')
    const { login, register } = auth

    /* =========================
    Test helpers
    ========================= */
    const makeApp = (handler, path = '/act') => {
    const app = express()
    app.use(express.json())
    app.post(path, (req, res) => handler(req, res))
    return app
    }

    // Fake mssql pool that returns sequence[i] on each .query()
    function makePoolWithQueries(sequence) {
    let i = 0
    return {
        request() {
        return {
            input() { return this }, // allow chaining .input(...).input(...).query(...)
            async query(_sql) {
            const step = sequence[i++]
            if (!step) throw new Error('no more mock results')
            if (step.reject) throw new Error(step.reject)
            return step // e.g. { recordset: [...] }
            }
        }
        }
    }
    }

    beforeEach(() => {
    jest.clearAllMocks()
    })

    /* =========================
    LOGIN
    ========================= */
    describe('auth.login', () => {
    test('400 when email/password missing', async () => {
        const res = await request(makeApp(login)).post('/act').send({ email: '', password: '' })
        expect(res.status).toBe(400)
    })

    test('401 when user not found', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [] } // first (and only) query: no rows
        ]))

        const res = await request(makeApp(login))
        .post('/act')
        .send({ email: 'x@y.com', password: 'nope' })

        expect(res.status).toBe(401)
    })

    test('401 when password mismatch', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ User_ID: 7, Email: 's@example.com', First_Name: 'S', Last_Name: 'T', Password: 'hash', RoleName: 'STUDENT' }] }
        ]))
        compareMock.mockResolvedValueOnce(false)

        const res = await request(makeApp(login))
        .post('/act')
        .send({ email: 's@example.com', password: 'wrong' })

        expect(res.status).toBe(401)
    })

    test('200 and token on valid credentials', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ User_ID: 42, Email: 'tutor@example.com', First_Name: 'Ada', Last_Name: 'Lovelace', Password: 'hash', RoleName: 'TUTOR' }] }
        ]))
        compareMock.mockResolvedValueOnce(true)
        signUserMock.mockReturnValueOnce('stub.jwt.token')

        const res = await request(makeApp(login))
        .post('/act')
        .send({ email: 'tutor@example.com', password: 'Secret123!' })

        expect(res.status).toBe(200)
        expect(res.body).toEqual(expect.objectContaining({ token: 'stub.jwt.token' }))
        expect(signUserMock).toHaveBeenCalledWith(
        expect.objectContaining({ User_ID: 42, RoleName: 'TUTOR' })
        )
        expect(res.headers['set-cookie']).toBeDefined() // cookie set by controller
    })

    test('500 when DB throws', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { reject: 'db down' }
        ]))

        const res = await request(makeApp(login))
        .post('/act')
        .send({ email: 'a@b.com', password: 'x' })

        expect(res.status).toBe(500)
    })
    })

    /* =========================
    REGISTER
    ========================= */
    describe('auth.register', () => {
    test('400 when required fields missing', async () => {
        const res = await request(makeApp(register))
        .post('/act')
        .send({ email: '', password: '', role: '' })

        expect(res.status).toBe(400)
    })

    test('409 when email already registered', async () => {
        // 1) exists query returns a row -> 409
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [{ User_ID: 1 }] }
        ]))

        const res = await request(makeApp(register))
        .post('/act')
        .send({ email: 'dupe@e.com', password: 'x', role: 'TUTOR' })

        expect(res.status).toBe(409)
    })

    test('500 when role not found (getRoleId throws)', async () => {
        // 1) exists -> none
        // 2) roles -> empty -> getRoleId throws -> 500
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [] },
        { recordset: [] }
        ]))

        const res = await request(makeApp(register))
        .post('/act')
        .send({ email: 'a@b.com', password: 'x', role: 'TUTOR' })

        expect(res.status).toBe(500)
    })

    test('201 and token on success', async () => {
        // 1) exists -> none
        // 2) roles -> { Role_ID: 5 }
        // 3) insert -> returns created user subset
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [] },
        { recordset: [{ Role_ID: 5 }] },
        { recordset: [{ User_ID: 99, Email: 'new@e.com', First_Name: 'New', Last_Name: 'User' }] }
        ]))
        hashMock.mockResolvedValueOnce('hashed!')
        signUserMock.mockReturnValueOnce('stub.jwt.token')

        const res = await request(makeApp(register))
        .post('/act')
        .send({ email: 'new@e.com', password: 'P@ssw0rd', role: 'TUTOR', firstName: 'New', lastName: 'User' })

        expect(res.status).toBe(201)
        expect(res.body).toEqual(expect.objectContaining({
        token: 'stub.jwt.token',
        user: expect.objectContaining({
            User_ID: 99,
            Email: 'new@e.com',
            First_Name: 'New',
            Last_Name: 'User',
            Role: 'TUTOR'
        })
        }))
        expect(res.headers['set-cookie']).toBeDefined()
    })

    test('500 when insert query rejects', async () => {
        getPoolMock.mockResolvedValueOnce(makePoolWithQueries([
        { recordset: [] },               // exists
        { recordset: [{ Role_ID: 5 }] }, // role OK
        { reject: 'insert failed' }      // DB insert error
        ]))

        const res = await request(makeApp(register))
        .post('/act')
        .send({ email: 'a@b.com', password: 'x', role: 'TUTOR' })

        expect(res.status).toBe(500)
    })
})
