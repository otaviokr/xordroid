const { readdirSync } = require('fs');
const dotenv = require('dotenv');
const OBSWebSocket = require('obs-websocket-js');
const obs = new OBSWebSocket();
const tmi = require('tmi.js');
const MQTT = require("mqtt");
const { Console } = require('console');
const mongoose = require('mongoose');
var player = require('play-sound')(opts = {});
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');


const clienttts = new textToSpeech.TextToSpeechClient();

async function quickStart(message) {
  // The text to synthesize
  const text = message;

  // Construct the request
  const request = {
    input: {text: text},
    // Select the language and SSML voice gender (optional)
    voice: {languageCode: 'pt-BR', ssmlGender: 'NEUTRAL'},
    // select the type of audio encoding
    audioConfig: {audioEncoding: 'MP3'},
  };

  // Performs the text-to-speech request
  const [response] = await clienttts.synthesizeSpeech(request);
  // Write the binary audio content to a local file
  const writeFile = util.promisify(fs.writeFile);
  await writeFile('output.mp3', response.audioContent, 'binary');
  setTimeout(() => {
    player.play('output.mp3', function(err){
      if (err) throw err
      return;
    });
  },1000);
  console.log('Audio content written to file: output.mp3');
}


mongoose.connect('mongodb://xordroid_points:TbfUhRuxEvqvA3j4@localhost:27018/admin', {useNewUrlParser: true});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("Papai ta ON");
});

const botSchema = new mongoose.Schema({
  userid: String,
  points: Number
});

const botDB = mongoose.model('BOT', botSchema);

// const silence = new botDB({ userid: 'Silence 17', points: 10 });
// console.log("******************");
// console.log(silence.userid); // 'Silence'
// console.log("******************");
// silence.save();

dotenv.config();

const TWITCH_BOT_USERNAME = process.env.BOT_USERNAME;
const TWITCH_OAUTH_TOKEN = process.env.OAUTH_TOKEN;
const TWITCH_CHANNEL_NAME = process.env.CHANNEL_NAME.split(',');
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_CLIENT = process.env.MQTT_CLIENT;
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PW = process.env.MQTT_PW;

const mqtt_options = {
	host: MQTT_HOST,
	clientId: MQTT_CLIENT,
	username: MQTT_USER,
	password: MQTT_PW
};

var porta;
var messages = [];
var commandQueue = [];
var ttsQueue = [];
var timerIsOn = true;
const mqtt = MQTT.connect(mqtt_options);

mqtt.on('connect', function () {
  mqtt.subscribe('xordroid/weather/keepAlive', function (err) {
    if (!err) {
			mqtt.publish('xordroid/weather/keepAlive', 'Hello mqtt');
			console.log("MQTT Ready!");
			mqtt.publish("wled/158690/api", "FX=80&SN=1");
			mqtt.publish("wled/158690/col", "#7FFF00");
			mqtt.publish("wled/158690", "ON");
    }
  });

  mqtt.subscribe('xordroid/timerIsOn', function (err) {
  });

  mqtt.on('message', function (topic, message) {
    if(topic.toString() == 'xordroid/timerIsOn') {
      var isTrueSet = (message == 'true');
      timerIsOn = isTrueSet;
    }
  });

  setInterval(() => {
    if(timerIsOn) {
      if(messages.length > 0) {
            let message = messages.shift();
            mqtt.publish("xordroid/message", message);
      }
    }
  }, 1500);

  setInterval(() => {
    if(ttsQueue.length > 0) {
      let tts = ttsQueue.shift();
      quickStart(tts);
    }
  }, 2500);
});

// mqtt.subscribe("homie/temperature/temperature/degrees");
// mqtt.on("message", (topic, message) => {
//   console.log("MQTT DEBUG");
//   if(topic === "homie/temperature/temperature/degrees") {
//     messages.push(`Agora no quarto: ${JSON.parse(message)} oC`);
//   }
// });

const client = new tmi.Client({
  options: {
    debug: false,
    level: 'warn',
  },
	connection: {
		reconnect: true,
		secure: true
	},
	identity: {
		username: TWITCH_BOT_USERNAME,
		password: TWITCH_OAUTH_TOKEN
	},
  channels: TWITCH_CHANNEL_NAME
});

function parse_commands(raw_commands, username) {
	if(raw_commands[0] === "!comandos"||raw_commands[0] === "!help"| raw_commands[0] === "!ajuda") {
		client.say(client.channels[0], '!led help | !eu | !camera help | !matrix <mensagem> | !donate | !github | !dica | !projetos | tem  mais mas você terá que descobrir :P');
	}
}



client.on("join", (channel, username, self) => {
  if(self) {
    // client.say(channel,"Olá pessoas, eu sou o XORDroid, manda um !comandos ai no chat e veja minhas funcionalidades ;D ... e !projetos pra ver o que já fizemos");
    client.say(channel, "To on!");
	}
});

client.on('message', (channel, tags, message, self) => {
  if(self) return;
  const commands = [
      "!led"
    , "!mqtt"
    , "!comandos"
    , "!social"
    , "!eu"
    , "!camera"
    , "!tela"
    , "!proto"
    , "!webcam"
    , "!youtube"
    , "!instagram"
    , "!github"
    , "!teste"
    , "!matrix"
    , "!donate"
    , "!xordroid"
    , "!streamdeckble"
    , "!streamdeck"
    , "!gatekeeperiot"
    , "!gatekeeper"
    , "!projetos"
    , "!projects"
    , "!ajuda"
    , "!help"
  ];
  message_parse = message.split(" "); // split message
  // verificar se só o primeiro é o comando
	if(commands.includes(message_parse[0])) { // has commands on message
		parse_commands(message_parse, tags.username);
		return;
	}
});

client.connect();

readdirSync(`${__dirname}/commands`)
  .filter((file) => file.slice(-3) === '.js')
  .forEach((file) => {
		require(`./commands/${file}`).default(client, obs, mqtt, messages, botDB, commandQueue, ttsQueue);
  });