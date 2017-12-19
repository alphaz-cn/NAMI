const app = require('koa')()
  , koa = require('koa-router')()
  , co = require('co')
  , logger = require('koa-logger')
  , json = require('koa-json')
  , views = require('koa-views')    
  , bluebird = require('bluebird')
  , onerror = require('koa-onerror');

const index = require('./routes/index')
   , upload = require('./routes/upload')
   , db = require('./models/db-mongo')
   , Online = require('./models/online-mongo')
   , Room = require('./models/room-mongo')    
   , User = require('./models/user-mongo')
   , History = require('./models/history-mongo')
   , message = require('./controllers/message')
   , crConfig = require('./config/cr-config')
   , jwt = require('jsonwebtoken')
   , JWT_KEY = require('./config/cr-config').JWT_KEY
   , bcrypt = require('bcrypt-nodejs');

co(function *() {
    let initRoom = yield Room.findOne({name: crConfig.INIT_ROOM});
    if(!initRoom){
        let room = new Room({
            info: crConfig.INIT_ROOM_INFO,
            name: crConfig.INIT_ROOM
        })
        yield room.save();
    } else {
      console.log('初始房间已存在');
    }

    let room = yield Room.findOne({name: crConfig.INIT_ROOM});
    let adminUser = yield User.findOne({email: crConfig.INIT_ADMIN_EMAIL});
    if(!adminUser){
      let email = "happyyi66@outlook.com",
          salt = yield bluebird.promisify(bcrypt.genSalt)(10),
          password = yield bluebird.promisify(bcrypt.hash)("king7890",salt,null); 
      let resault  = yield User.create({ nickname:"管理员", email:email, password:password, rooms:[room._id] });
      if(resault && room){ 
          room.users.push(resault._id);
          if(email === crConfig.INIT_ADMIN_EMAIL) room.creater = resault._id;
          yield room.save();
          let exp = Math.floor((new Date().getTime())/1000) + 60 * 60 * 24 * 30;
          let verify = jwt.sign({ user: resault._id, exp: exp },JWT_KEY);
      }
    } else {
      console.log('管理员已存在');
    }
    yield Online.remove({});
}).catch((err)=>{
    console.log(err);
});

app.use(views('views', {
  root: __dirname + '/views',
  default: 'jade'
}));
app.use(require('koa-bodyparser')());
app.use(json());
app.use(logger());
 
app.use(function *(next){
  var start = new Date;
  yield next;
  var ms = new Date - start;
  console.log('%s %s - %s', this.method, this.url, ms);
});

app.use(require('koa-static')(__dirname + '/public'));

// routes definition
koa.use('/upload', upload.routes(), index.allowedMethods());
koa.use('/', index.routes(), index.allowedMethods());
app.use(koa.routes());
onerror(app);
app.on('error', function(err, ctx){
  console.log('err message:',err.message);
  // logger.error('server error', err, ctx);
});

module.exports = app;