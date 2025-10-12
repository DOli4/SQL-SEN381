
import { jest } from '@jest/globals'

// ESM mock for jsonwebtoken
const signMock = jest.fn(() => 'stub.jwt.token')
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: { sign: signMock },   // matches: import jwt from 'jsonwebtoken'; jwt.sign(...)
  sign: signMock                 // (in case named import is used later)
}))

// Now import SUT after the mock is set up
const { signUser } = await import('../../src/utils/jwt.js')

beforeEach(() => {
    signMock.mockClear()
    // sane defaults for env
    process.env.JWT_SECRET = 'test-secret'
    process.env.JWT_EXPIRES_IN = '2h'
})

test('calls jsonwebtoken.sign with correct payload, secret, and options', () => {
    const user = {
        User_ID: 42,
        Email: 'tutor@example.com',
        First_Name: 'Ada',
        Last_Name: 'Lovelace',
        RoleName: 'TUTOR'
    }

    const token = signUser(user)

    expect(token).toBe('stub.jwt.token')
    expect(signMock).toHaveBeenCalledTimes(1)
    const [payload, secret, opts] = signMock.mock.calls[0]

    expect(payload).toEqual({
        sub: 42,
        email: 'tutor@example.com',
        name: 'Ada Lovelace',
        role: 'TUTOR'
    })
    expect(secret).toBe('test-secret')
    expect(opts).toEqual({ expiresIn: '2h' })
})

test('name is joined & trimmed (handles missing Last_Name)', () => {
    const user = {
        User_ID: 7,
        Email: 's@example.com',
        First_Name: '  Sam  ',
        Last_Name: '',
        RoleName: 'STUDENT'
    }
    signUser(user)

    const [payload] = signMock.mock.calls[0]
  expect(payload.name).toBe('Sam')     // no trailing space
})

test('uses default expiresIn=1d when JWT_EXPIRES_IN is unset', () => {
    delete process.env.JWT_EXPIRES_IN
    const user = {
        User_ID: 1,
        Email: 'x@y.com',
        First_Name: 'A',
        Last_Name: 'B',
        RoleName: 'ADMIN'
    }
    signUser(user)

    const [, , opts] = signMock.mock.calls[0]
    expect(opts).toEqual({ expiresIn: '1d' })
})
