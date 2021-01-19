import React, {useState, useEffect} from 'react'
import useSWR from 'swr'
import {get, isEmpty, isUndefined, orderBy, uniq} from 'lodash'
import OAuthClient from 'client-oauth2'

/* 
The viewer_count is displayed as an overlay on the thumbnail_url.
To find how long the streamer has been streaming, you check the `started_at` and compare that to what the time is now. 
How long the streamer has been streaming is in the top right of the thumbnail. 
I need to learn how to display items on top of the thumbnail. 
Can I get a list of games that a user follows? I don't see this in the API. I don't know if it is possible.

A way to refresh the contents on a page would be a good idea. 
*/

// Look into GraphQL https://github.com/mauricew/twitch-graphql-api

const USER_NAME = 'https://api.twitch.tv/helix/users?login=<username>'
const STREAMS_URL = 'https://api.twitch.tv/helix/streams?user_id='
const BEARER_TOKEN = process.env.NEXT_PUBLIC_BEARER_TOKEN
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID
const REDIRECT_URL = 'http://localhost:3000/twitch'

const twitchOauthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URL}&response_type=token&scope=user:read:email`

function replaceThumbnailSize(url, size) {
  return url.replace(/{width}x{height}/, size)
}

function insertId(el, cursor) {
  if (!el) return
  let url = 'https://api.twitch.tv/helix/users/follows?from_id=<user_id>&first=100'.replace(
    /<user_id>/,
    el,
  )
  if (cursor) {
    url = url + '&after=' + cursor
  }
  return url
}

function insertUsername(url, username) {
  if (username) {
    return url.replace(/<username>/, username)
  } else {
    return 'https://api.twitch.tv/helix/users'
  }
}

function buildGameUrl(el) {
  if (!el) return
  let url = 'https://api.twitch.tv/helix/games?id=<game_id>'
  return url.replace(/<game_id>/, el)
}

const twitchAuth = new OAuthClient({
  clientId: BEARER_TOKEN,
  authorizationUri: `https://id.twitch.tv/oauth2/authorize`,
  accessTokenUri: `https://id.twitch.tv/oauth2/token`,
  redirectUri: REDIRECT_URL,
})

const ACCESS_TOKEN_KEY = 'ACCESS_TOKEN_KEY'

const setSession = clientOauthToken => {
  if (typeof localStorage === 'undefined') {
    return
  }
  const expiresAt = JSON.stringify(
    clientOauthToken.data.expires_in * 1000 + new Date().getTime(),
  )

  localStorage.setItem(ACCESS_TOKEN_KEY, clientOauthToken.accessToken)
  localStorage.setItem('EXPIRES_AT_KEY', expiresAt)
}

const handleAuthentication = (location, oauthClient, callback) => {
  if (typeof location === 'undefined') {
    return
  } // Not necessary since I'm running in the browser.
  return new Promise((resolve, reject) => {
    oauthClient.token.getToken(location).then(
      clientOauthToken => {
        setSession(clientOauthToken)
        window.history.pushState(
          '',
          document.title,
          window.location.pathname + window.location.search,
        )
        callback(clientOauthToken)
        resolve(clientOauthToken)
      },
      error => {
        console.error(error)
      },
    )
  })
}

// const getAccessToken = () => {
//   return localStorage.getItem(ACCESS_TOKEN_KEY)
// }

const initialStreamsData = {streams: [], currentCursor: null, total: null}

function TwitchApp() {

  const [streamsData, setStreamsData] = useState(initialStreamsData)
  const [accessToken, setAccessToken] = useState()
  const [username, setUsername] = useState()
  const [liveStreamers, setLiveStreamers] = useState([])
  const [gameName, setGameName] = useState({})

  function handleToken (clientOauthToken){
    setAccessToken(clientOauthToken.accessToken)
  }

  console.log(accessToken)

  
  useEffect(() => {
    if (!accessToken) {
      handleAuthentication(window.location, twitchAuth, handleToken)
    }
  }, [accessToken])
  
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
  
  let id = insertUsername(USER_NAME, username)
  const loadUserId = isUndefined(accessToken) ? null : [id, accessToken]
  let fetchApi = async (url, accessToken) => {
    const response = await fetch(url, {
      body: JSON.stringify({accessToken})
    })
    return response.json()
  }
  let loadApiKey = isUndefined(accessToken) ? null : ['api/twitch', accessToken]
  console.log(loadApiKey)
  useSWR(loadApiKey, fetchApi)
  const {data: currentUser} = useSWR(loadUserId, getData)
  // useSWR actually uses useEffect. It's a wrapper that allows you access OUTSIDE of react, our HTTP requests.
  const streamIds =
    streamsData.streams.length === streamsData.total
      ? null
      : [insertId(get(currentUser, 'data[0].id'), streamsData.currentCursor), accessToken]
  const {data: streams} = useSWR(streamIds, getData, {
    onSuccess: streamsResponse => {
      // streams isn't used. Why is that?
      const newStreams = streamsData.streams.concat(streamsResponse.data)
      const currentCursor = get(streamsResponse, 'pagination.cursor')
      setStreamsData({
        streams: newStreams,
        currentCursor,
        total: streamsResponse.total,
      })
      const listStreamIds = streamsResponse.data.map(x => x.to_id)
      const streamsUrl = STREAMS_URL + listStreamIds.join('&user_id=')
      if (isEmpty(listStreamIds)) {
        return
      } else {
        getData(streamsUrl, accessToken).then(response => {
          setLiveStreamers(currentLiveStreamers => {
            const newLiveStreams = currentLiveStreamers.concat(response.data)
            return newLiveStreams
          })
        })
      } 
    },
  })

  // Need to learn error handling for when there are no streamers live at the time.

  // How to find live games based on their unique id and building a list.
  let liveGameIds = uniq(
    liveStreamers.map(stream => {
      return stream.game_id
    }),
  )

  // Building an array of the live games so I can attach them to the streamer's list on the app.
  const loadGameUrl = isEmpty(liveGameIds) || isUndefined(accessToken) ? null : [buildGameUrl(liveGameIds.join('&id=')), accessToken]
  useSWR(loadGameUrl, getData, {
    onSuccess: successfulResponse => {
      setGameName(
        successfulResponse.data.reduce((acc, curr) => {
          acc[curr.id] = curr
          return acc
        }, {}),
      )
    },
  })

  function resetStreamerState() {
    // sets state back to initial state defined in setState
    setStreamsData(initialStreamsData)
    setLiveStreamers([])
    setGameName({})
  }

  function handleSubmit(evt) {
    evt.preventDefault()
    resetStreamerState()
    setUsername(evt.target.elements.username.value)
  }

  function logOut() {
    localStorage.setItem(ACCESS_TOKEN_KEY, '')
    resetStreamerState()
  }

  return (
    <div className="App">
      <header className="App-header">
        <nav className="top-nav">
          <div>
            <button onClick={logOut}>Logout of Twitch</button>
            <a href={twitchOauthUrl}>Login to Twitch</a>
            {/* This is only showing up randomly. Sometimes automatic, when I click randomly, but does 100% on refresh. */}
            <form className="input" onSubmit={handleSubmit}>
              <label>Search for a user: </label>
              <input
                autoFocus={true}
                type="text"
                id="username"
                defaultValue=""
              />
              <input type="submit" />
            </form>
          </div>
        </nav>

        {/* Thinking about using tailwind for styling - side project? */}
        <nav className="main-nav">
          <ul className="boxes">
            {orderBy(liveStreamers, ['viewer_count'], ['desc']).map(
              liveStream => {
                // styling: https://egghead.io/playlists/create-a-landing-page-with-css-grid-and-flexbox-6048
                // https://egghead.io/lessons/flexbox-create-an-automatically-responsive-flexbox-gallery

                return (
                  <li className="box-container">
                    <div>
                      {/*Need to make spaces between elements smaller, a bit more compact.*/}
                      <a href={'https://twitch.tv/' + liveStream.user_name}>
                        <img
                          className="img"
                          alt=""
                          src={replaceThumbnailSize(
                            liveStream.thumbnail_url,
                            '360x200',
                          )}
                        ></img>
                        {/* use a ref to query the size of the element */}
                      </a>
                      <div className="text-container">
                        <a href={'https://twitch.tv/' + liveStream.user_name}>
                          <h4 className="username">{liveStream.user_name}</h4>
                        </a>
                        <a href={'https://twitch.tv/' + liveStream.user_name}>
                          <h5 className="title" title={liveStream.title}>
                            {liveStream.title}
                          </h5>
                        </a>
                        {/* Make it so that hovering over lines that are cut off show the whole line so the user can read it. reachui then tipy.js */}
                        <a href={'https://twitch.tv/' + liveStream.user_name}>
                          <h3 className="viewers">
                            Viewers: {liveStream.viewer_count}
                          </h3>
                        </a>
                        <a
                          href={
                            'https://twitch.tv/directory/game/' +
                            get(gameName, `${liveStream.game_id}.name`)
                          }
                        >
                          <h3 className="viewers">
                            {get(gameName, `${liveStream.game_id}.name`)}
                          </h3>
                        </a>
                      </div>
                    </div>
                  </li>
                )
              },
            )}
          </ul>
        </nav>
      </header>
    </div>
  )
}

export default TwitchApp
