
import { jest, describe, test, expect, beforeEach } from '@jest/globals'

// import default export (ESM)
const { default: allowRoles } = await import('../../src/middleware/rbac.js')

const mockRes = () => {
    const res = {}
    res.status = jest.fn().mockReturnValue(res)
    res.json = jest.fn().mockReturnValue(res)
    return res
}

let res, next
beforeEach(() => {
    res = mockRes()
    next = jest.fn()
})

describe('middleware/rbac allowRoles', () => {
    test('401 when req.user is missing', () => {
    const mw = allowRoles('TUTOR')
    const req = { user: null }

    mw(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
    })

    test('403 when role is not allowed', () => {
    const mw = allowRoles('TUTOR')
    const req = { user: { role: 'STUDENT' } }

    mw(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' })
    })

    test('calls next() when role is allowed (single)', () => {
    const mw = allowRoles('TUTOR')
    const req = { user: { role: 'TUTOR' } }

    mw(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
    })

    test('calls next() when role is in a multi-role allow list', () => {
    const mw = allowRoles('ADMIN', 'TUTOR')
    const req = { user: { role: 'ADMIN' } }

    mw(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    })

    test('403 when allow list is empty (defensive check)', () => {
    const mw = allowRoles() // no roles provided
    const req = { user: { role: 'ADMIN' } }

    mw(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    
    })
})
