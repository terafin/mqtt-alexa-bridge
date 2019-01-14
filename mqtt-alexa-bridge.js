// Requirements
const mqtt = require('mqtt')
const async = require('async')
const config = require('homeautomation-js-lib/config_loading.js')
const logging = require('homeautomation-js-lib/logging.js')
const _ = require('lodash')
const health = require('homeautomation-js-lib/health.js')
const Alexa = require('alexa-remote2')
const alexa = new Alexa()

var topic_prefix = process.env.TOPIC_PREFIX
var cookie = process.env.ALEXA_COOKIE
var username = process.env.ALEXA_EMAIL
var password = process.env.ALEXA_PASSWORD
var userAgent = process.env.ALEXA_USER_AGENT
var alexaServiceHost = process.env.ALEXA_SERVICE_HOST
var acceptLanguage = process.env.ALEXA_ACCEPT_LANGUAGE
var amazonPage = process.env.ALEXA_AMAZON_PAGE

if (_.isNil(topic_prefix)) {
	logging.warn('empty topic prefix, using /alexa')
	topic_prefix = '/alexa/'
}

require('homeautomation-js-lib/mqtt_helpers.js')

var connectedEvent = function() {
	logging.info('MQTT Connected')
	client.subscribe(topic_prefix + '/#', {qos: 2})
	health.healthyEvent()
}

var disconnectedEvent = function() {
	logging.error('Reconnecting...')
	health.unhealthyEvent()
}

// Setup MQTT
var client = mqtt.setupClient(connectedEvent, disconnectedEvent)

if (_.isNil(client)) {
	logging.warn('MQTT Client Failed to Startup')
	process.abort()
}

// MQTT Observation

client.on('message', (topic, message) => {
	topic = topic.replace(topic_prefix + '/', '')

	var components = topic.split('/')
	
	const nameOrSerial = components[0]
	const command = components[1]

	alexa.sendSequenceCommand(nameOrSerial, command, message)
})

alexa.init({
	cookie: cookie,  // cookie if already known, else can be generated using email/password
	email: username,    // optional, amazon email for login to get new cookie
	password: password, // optional, amazon password for login to get new cookie
	proxyOnly: false,
	proxyOwnIp: 'localhost',
	proxyPort: 3001,
	proxyLogLevel: 'info',
	bluetooth: true,
	// logger: console.log, // optional
	userAgent: userAgent,
	alexaServiceHost: alexaServiceHost,
	acceptLanguage: acceptLanguage,
	amazonPage: amazonPage,
	useWsMqtt: true, // optional, true to use the Websocket/MQTT direct push connection
	cookieRefreshInterval: 5*24*60*1000 // optional, cookie refresh intervall, set to 0 to disable refresh
},
function(err) {
	if (err) {
		logging.error('Setup error:' + err)
		return
	}
}
)

