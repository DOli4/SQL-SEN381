    // src/controllers/subscriptions.controller.js
    import { getPool, sql } from '../db/mssql.js'

    /**
     * GET /api/users/:userId/subscriptions?limit=10&page=1
     * Returns the list of topics a user is subscribed to (paginated).
     * Enforces: user can only access their own list unless admin/tutor, etc.
     */
    export async function getUserSubscriptions(req, res) {
    const auth = req.user // injected by requireAuth
    const userIdParam = Number(req.params.userId)
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 10)))
    const page  = Math.max(1, Number(req.query.page || 1))
    const offset = (page - 1) * limit

    // Access control: a user may only access their own list unless elevated
    const role = (auth?.RoleName || auth?.role || '').toUpperCase()
    const sameUser = auth?.sub === userIdParam
    const isElevated = role === 'ADMIN' || role === 'TUTOR'
    if (!sameUser && !isElevated) {
        return res.status(403).json({ error: 'Forbidden' })
    }

    try {
        const pool = await getPool()

        // Total count for pagination (optional in your table spec)
        const countR = await pool.request()
        .input('User_ID', sql.Int(), userIdParam)
        .query('SELECT COUNT(*) AS Total FROM dbo.TopicSub WHERE User_ID = @User_ID')

        const r = await pool.request()
        .input('User_ID', sql.Int(), userIdParam)
        .input('limit', sql.Int(), limit)
        .input('offset', sql.Int(), offset)
        .query(`
            SELECT ts.Topic_ID, ts.User_ID, t.Title, t.Module_ID
            FROM dbo.TopicSub ts
            JOIN dbo.Topic t ON ts.Topic_ID = t.Topic_ID
            WHERE ts.User_ID = @User_ID
            ORDER BY ts.Topic_ID
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `)

        const totalCount = countR.recordset?.[0]?.Total ?? r.recordset.length
        return res.json({ items: r.recordset, totalCount, page, limit })
    } catch (e) {
        console.error('GET USER SUBSCRIPTIONS ERROR:', e)
        return res.status(500).json({ error: 'Failed to retrieve subscriptions: ' + e.message })
    }
    }

    /**
     * (optional) GET /api/topics/:topicId/subscribers
     * List all users subscribed to a given topic (admin/tutor only).
     */
    export async function getTopicSubscribers(req, res) {
    const auth = req.user
    const role = (auth?.RoleName || auth?.role || '').toUpperCase()
    if (role !== 'ADMIN' && role !== 'TUTOR') {
        return res.status(403).json({ error: 'Forbidden' })
    }

    const topicId = Number(req.params.topicId)
    try {
        const pool = await getPool()
        const r = await pool.request()
        .input('Topic_ID', sql.Int(), topicId)
        .query(`
            SELECT ts.User_ID, u.Email, u.First_Name, u.Last_Name
            FROM dbo.TopicSub ts
            JOIN dbo.[User] u ON u.User_ID = ts.User_ID
            WHERE ts.Topic_ID = @Topic_ID
        `)
        return res.json(r.recordset)
    } catch (e) {
        console.error('GET TOPIC SUBSCRIBERS ERROR:', e)
        return res.status(500).json({ error: 'Failed to retrieve subscribers: ' + e.message })
    }
}
