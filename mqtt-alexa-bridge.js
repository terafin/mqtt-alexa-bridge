// Requirements
const mqtt = require('mqtt')
const logging = require('homeautomation-js-lib/logging.js')
const _ = require('lodash')
const health = require('homeautomation-js-lib/health.js')
const Alexa = require('alexa-remote2')
const alexa = new Alexa()
const mqtt_helpers = require('homeautomation-js-lib/mqtt_helpers.js')

var topic_prefix = process.env.TOPIC_PREFIX
var cookie = process.env.ALEXA_COOKIE
var username = process.env.ALEXA_EMAIL
var password = process.env.ALEXA_PASSWORD
var userAgent = process.env.ALEXA_USER_AGENT
var alexaServiceHost = process.env.ALEXA_SERVICE_HOST
var acceptLanguage = process.env.ALEXA_ACCEPT_LANGUAGE
var amazonPage = process.env.ALEXA_AMAZON_PAGE
var macDms = process.env.ALEXA_MACDMS

process.env["NODE_TLS_REJECT_UNAUTHORIZED"]

if (_.isNil(topic_prefix)) {
    logging.warn('empty topic prefix, using /alexa')
    topic_prefix = '/alexa/'
}


var connectedEvent = function() {
    logging.info('MQTT Connected')
    client.subscribe(topic_prefix + '/#', { qos: 1 })
    health.healthyEvent()
}

var disconnectedEvent = function() {
    logging.error('Reconnecting...')
    health.unhealthyEvent()
}

// Setup MQTT
var client = mqtt_helpers.setupClient(connectedEvent, disconnectedEvent)

if (_.isNil(client)) {
    logging.warn('MQTT Client Failed to Startup')
    process.abort()
}

// MQTT Observation
client.on('message', (topic, message) => {
    topic = topic.replace(topic_prefix + '/', '')
    logging.info('Received ' + topic + ' : ' + message)

    var components = topic.split('/')

    const nameOrSerial = components[0]
    const command = components[1]
    logging.info(' => nameOrSerial: ' + nameOrSerial)
    logging.info('         command: ' + command)
    logging.info('         message: ' + message)

    alexa.sendSequenceCommand(nameOrSerial, command, message)
})

alexa.init({
        cookie: cookie,
        // email: username, // optional, amazon email for login to get new cookie
        // password: password, // optional, amazon password for login to get new cookie
        proxyOnly: true,
        proxyOwnIp: 'localhost',
        proxyPort: 3001,
        proxyLogLevel: 'info',
        bluetooth: false,
        // logger: console.log, // optional
        macDms: macDms,
        userAgent: userAgent,
        alexaServiceHost: alexaServiceHost,
        acceptLanguage: acceptLanguage,
        amazonPage: amazonPage,
        useWsMqtt: true, // optional, true to use the Websocket/MQTT direct push connection
        cookieRefreshInterval: 5 * 24 * 60 * 1000 // optional, cookie refresh intervall, set to 0 to disable refresh
    },
    function(err) {
        if (err) {
            logging.error('Setup error:' + err)
            return
        }
        logging.info('alexa cookie: ' + alexa.cookie)
    }
)

alexa.on('cookie', (cookie, csrf, macDms) => {
    logging.info('cookie: ' + cookie)
    logging.info('csrf: ' + csrf)
    logging.info('macDms: ' + JSON.stringify(macDms))
})
