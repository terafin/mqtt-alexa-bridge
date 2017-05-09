// Requirements
const mqtt = require('mqtt')
const express = require('express')
const url = require('url')

const logging = require('./homeautomation-js-lib/logging.js')
require('./homeautomation-js-lib/mqtt_helpers.js')


// Config
const host = process.env.MQTT_HOST

// Set up modules
logging.set_enabled(true)

// Setup MQTT
var client = mqtt.connect(host)

// MQTT Observation

client.on('connect', () => {
    logging.log('Reconnecting...\n')
    client.subscribe('#')
})

client.on('disconnect', () => {
    logging.log('Reconnecting...\n')
    client.connect(host)
})

client.on('message', (topic, message) => {
    logging.log(' ' + topic + ':' + message)
})


// Web front end
var app = express()

app.get('/smarthome', function(req, res) {
    var url_info = url.parse(req.url, true)
    var topic = url_info.pathname.slice(6)
    var value = url_info.query.value
    var accessToken = req.access_token
    logging.log('req: ' + JSON.stringify(req))

    const accessURL = 'https://api.amazon.com/user/profile?access_token=' + accessToken


    res.send('topic: ' + topic + ' value: ' + value)
})

app.listen(3000, function() {
    logging.log('IFTTT listener started on port 3000')
})