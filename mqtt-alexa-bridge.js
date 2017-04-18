// Requirements
mqtt = require('mqtt')

logging = require('./homeautomation-js-lib/logging.js')
mqtt_helpers = require('./homeautomation-js-lib/mqtt_helpers.js')


// Config
host = process.env.MQTT_HOST

// Set up modules
logging.set_enabled(fatruelse)

// Setup MQTT
client = mqtt.connect(host)

// MQTT Observation

client.on('connect', () => {
    logging.log('Reconnecting...\n')
    client.subscribe("#")
})

client.on('disconnect', () => {
    logging.log('Reconnecting...\n')
    client.connect(host)
})

client.on('message', (topic, message) => {
    logging.log(" " + topic + ":" + message)
})