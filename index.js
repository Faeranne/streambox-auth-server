const Express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cookieSession = require('cookie-session')
const passport = require('passport')
const BearerStrategy = require('passport-http-bearer').Strategy
const TwitchStrategy = require('passport-twitch').Strategy
const LowDB = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const twitchApi = require('twitch-api-v5')
const FindOrCreate = require('./findOrCreate.js')

const adapter = new FileSync('db.json',{
  defaultValue: {twitch:[],boxes:[]}
})
const db = LowDB(adapter)
const app = Express()

twitchApi.clientID = process.env.TWITCH_CLIENTID

db.read()

FindOrCreate(db._) //Mixin the FindOrCreate function

app.set("views", "./views");
app.set("view engine","ejs");

app.use(bodyParser.urlencoded({ extended: true}))
app.use(bodyParser.json({type: 'application/json'}))
app.use(cookieParser())
app.use(cookieSession({secret:"TestSecretHere"}))
app.use(passport.initialize())
app.use(passport.session())
app.use(Express.static("./public"))

passport.use(new TwitchStrategy({
        clientID: process.env.TWITCH_CLIENTID,
        clientSecret: process.env.TWITCH_SECRET,
        callbackURL: "http://localhost:3000/auth/twitch/callback",
        scope: "channel_read user_read channel_editor"
  },
  function(accessToken,refreshToken,profile,done){
    return done(null,db.get('users').findOrCreate({twitchId:profile.id}).assign({access:accessToken,refresh:refreshToken,type:"twitch"}).write())
  }
))

passport.use(new BearerStrategy(
    function(token,done){
      console.log(token)
      const user = db.get('boxes').find({token:token}).value()
      if(!user){
        return done(null, false)
      }
      return done(null,user,{scope: 'all'})
    }
))

app.get("/",function(req,res){
  res.render("index")
})
app.get("/auth/twitch",passport.authenticate("twitch"));
app.get("/auth/twitch/callback", passport.authenticate("twitch", { falureRedirect: "/"}), function(req,res){
  res.redirect("/twitch/code")
})

app.post("/twitch/code",function(req,res){
  if(!req.user){
    return res.send(401)
  }
  db.get('users').find({twitchId:req.user.twitchId}).assign({code:req.body.code}).write()
  res.send("Code Updated")
})
app.get("/twitch/code",function(req,res){
  res.render("code")
})

app.post("/streambox/endpoints",passport.authenticate('bearer', {session: false}),function(req,res){
  if(!req.user){
    return res.send(401);
  }
  const code = req.body.code
  const user = db.get('users').find({code:code}).value()
  if(user.type=="twitch"){
    twitchApi.channels.channel({auth:"OAuth "+user.access},function(err,channel){
      if(err){
        return channel.send(500)
      }
      console.log(channel)
      const stream_key = channel.stream_key
      const url = "rtmp://live.twitch.tv/app/"
      res.send(JSON.stringify({key:stream_key,server:url}))
    })
  }else{
    res.send(400)
  }
})

passport.serializeUser(function(user,done){
  done(null,user.twitchId);
})
passport.deserializeUser(function(user,done){
  theUser = db.get('users').find({twitchId:user}).value()
  done(null,theUser);
})

app.listen(3000)
