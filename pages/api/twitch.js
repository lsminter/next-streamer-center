

export default (req, res) => {
    const accessToken = req.query.accessToken
    const userId = req.query.userId
    if (!accessToken || !userId) {
        res.statusCode = 404
        res.json({error: 'Not Found'})
        res.end()
    } 
    res.statusCode = 200
    res.json({status: 'Success'})
}

// use node fetch instead of useSWR, this will be chaining '.then' promises.
// focus on getting `const {data: currentUser} = useSWR(loadUserId, getData)` into this file first