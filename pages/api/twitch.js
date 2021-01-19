const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID

function getUserFromTwitchUrl(userName) {
    const USER_NAME = 'https://api.twitch.tv/helix/users?login=<username>'
    
    if (userName) {
        return USER_NAME.replace(/<username>/, userName)
    } else {
        return 'https://api.twitch.tv/helix/users'
    }
}



async function getData(url, accessToken) {
    //look into axios possibly (*side project*)
    console.log(accessToken, url)
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ` + accessToken, // If I don't have an access token, I need to use the bearer token.
            'Client-ID': CLIENT_ID,
        },
    })
    return response.json()
}



// use node fetch instead of useSWR, this will be chaining '.then' promises.
// focus on getting `const {data: currentUser} = useSWR(loadUserId, getData)` into this file first

const fetchTwitchUser = async (accessToken) => {
    let userUrl = getUserFromTwitchUrl()
    return await getData(userUrl, accessToken)
}


export default async (req, res) => {
    const accessToken = req.query.accessToken
    if (!accessToken) {
        res.statusCode = 404
        res.json({error: 'Not Found'})
        res.end()
    } 
    const user = await fetchTwitchUser(accessToken)
    res.statusCode = 200
    res.json({result: user.data})
}