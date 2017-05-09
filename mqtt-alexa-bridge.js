// Requirements
const mqtt = require('mqtt')
const express = require('express')
const request = require('request')
const bodyParser = require('body-parser')
const config = require('./homeautomation-js-lib/config_loading.js')
const logging = require('./homeautomation-js-lib/logging.js')
const _ = require('lodash')

// Config
const listening_port = process.env.LISTENING_PORT
const host = process.env.MQTT_HOST
const alexaEmail = process.env.ALEXA_EMAIL
const configPath = process.env.CONFIG_PATH

if (_.isNil(configPath)) {
    logging.warn('CONFIG_PATH not set, not starting')
    process.abort()
}

if (_.isNil(listening_port)) {
    logging.warn('LISTENING_PORT not set, not starting')
    process.abort()
}

if (_.isNil(alexaEmail)) {
    logging.warn('ALEXA_EMAIL not set, not starting')
    process.abort()
}

if (_.isNil(host)) {
    logging.warn('MQTT_HOST not set, not starting')
    process.abort()
}

config.load_path(configPath)

var devicesConfig = []

config.on('config-loaded', () => {
    logging.debug('  Alexa config loaded')
    devicesConfig = []

    config.deviceIterator(function(deviceName, deviceConfig) {
        var deviceInfo = {
            name: deviceName,
            spoken_name: deviceConfig.name,
            topic: deviceConfig.topic,
            on: deviceConfig.on,
            off: deviceConfig.off
        }
        devicesConfig.push(deviceInfo)
        logging.debug('  found device info', deviceInfo)
    })

    if (!client.connected)
        client.connect(host)

})


// Setup MQTT
var client = mqtt.connect(host)

// MQTT Observation

client.on('connect', () => {
    logging.info('MQTT Connected')
})

client.on('disconnect', () => {
    logging.error('MQTT Disconnected, reconnecting')
    client.connect(host)
})


function generateDeviceDiscoveryPayload() {
    var deviceInfo = []

    devicesConfig.forEach(function(device) {
        deviceInfo.push({
            'actions': [
                'turnOn',
                'turnOff'
            ],
            'additionalApplianceDetails': {
                extraDetail1: 'optionalDetailForSkillAdapterToReferenceThisDevice'
            },
            'applianceId': device.name,
            'friendlyDescription': device.spoken_name,
            'friendlyName': device.spoken_name,
            'isReachable': true,
            'manufacturerName': 'AlexaMQTTBridge',
            'modelName': 'AlexaMQTTBridgeSwitch',
            'version': 'MQTTV1'
        })
    }, this)

    return deviceInfo
}

function deviceInfoForApplianceId(applianceId) {
    var foundDeviceInfo = null

    devicesConfig.forEach(function(device) {
        if (device.name == applianceId)
            foundDeviceInfo = device
    }, this)

    return foundDeviceInfo
}

var processRequest = function(req) {
    const namespace = req.body.header.namespace
    const msgID = req.body.header.messageId
    logging.debug('namespace: ' + namespace)

    var responseBody = {}
    switch (namespace) {
        case 'Alexa.ConnectedHome.Discovery':
            logging.debug(' => Discovery')
            responseBody = {
                'header': {
                    'messageId': msgID,
                    'namespace': 'Alexa.ConnectedHome.Discovery',
                    'name': 'DiscoverAppliancesResponse',
                    'payloadVersion': '2'

                },
                'payload': { discoveredAppliances: generateDeviceDiscoveryPayload() }
            }
            break
        case 'Alexa.ConnectedHome.System':
            logging.debug(' => Health Ping')
            responseBody = {
                'header': {
                    'messageId': msgID,
                    'name': 'HealthCheckResponse',
                    'namespace': 'Alexa.ConnectedHome.System',
                    'payloadVersion': '2'
                },
                'payload': {
                    'description': 'The system is currently healthy',
                    'isHealthy': true
                }
            }
            break
        case 'Alexa.ConnectedHome.Control':
            logging.debug(' => Control Action')
            var controlRequest = req.body.header.name
            var controlResponse = ''
            switch (controlRequest) {
                case 'TurnOnRequest':
                    controlResponse = 'TurnOnConfirmation'
                    break
                case 'TurnOffRequest':
                    controlResponse = 'TurnOffConfirmation'
                    break

            }
            var applianceId = req.body.payload.appliance.applianceId
            logging.debug(' => Request: ' + controlRequest)
            logging.debug(' => Response: ' + controlResponse)
            logging.debug(' => applianceId: ' + applianceId)

            responseBody = {
                'header': {
                    'messageId': msgID,
                    'name': controlResponse,
                    'namespace': 'Alexa.ConnectedHome.Control',
                    'payloadVersion': '2'
                },
                'payload': {}
            }
            var foundDeviceInfo = deviceInfoForApplianceId(applianceId)
            if (!_.isNil(foundDeviceInfo)) {
                var on_value = foundDeviceInfo.on
                var off_value = foundDeviceInfo.off
                const topic = foundDeviceInfo.topic
                if (_.isNil(on_value)) {
                    on_value = '1'
                }
                if (_.isNil(off_value)) {
                    off_value = '0'
                }
                if (!_.isNil(topic)) {
                    var publishValue = null
                    switch (controlRequest) {
                        case 'TurnOnRequest':
                            if (!_.isNil(on_value)) {
                                publishValue = on_value
                            }
                            break
                        case 'TurnOffRequest':
                            if (!_.isNil(off_value)) {
                                publishValue = off_value
                            }
                            break

                    }

                    if (!_.isNil(publishValue)) {
                        if (client.connected) {
                            client.publish(topic, '' + publishValue)
                            logging.info('alexa action', {
                                'action': 'alexa-request',
                                'topic': topic,
                                'value': publishValue,
                            })
                        } else {
                            logging.error('alexa action', {
                                'action': 'alexa-request',
                                'connected': client.connected,
                                'topic': topic,
                                'value': publishValue,
                            })
                        }
                    } else {
                        logging.error('alexa failed action', {
                            'action': 'alexa-request',
                            'topic': topic,
                            'value': publishValue,
                        })
                    }

                } else {
                    logging.error('alexa failed action', {
                        'action': 'alexa-request',
                        'topic': topic,
                        'value': publishValue,
                    })

                }
            }
            break
        default:
            responseBody = {}
            logging.debug(' => ** Unhandled request')
            break

    }
    logging.debug('returning response body', responseBody)

    return responseBody
}

var completeRequest = function(req, res, accessURL) {
    const responseBody = processRequest(req)
    logging.info('alexa-action-complete: ' + accessURL, {
        action: 'alexa-action-complete',
        url: accessURL
    })
    res.send(responseBody)
}


// Web front end
var app = express()

app.use(bodyParser.json())

var cachedAccessToken = null

app.post('/alexa/*', function(req, res) {
    // First verify our access token
    logging.debug('request body: ' + JSON.stringify(req.body.payload))
    var accessToken = req.body.payload.accessToken
    logging.debug('accessToken: ' + accessToken)

    const accessURL = 'https://api.amazon.com/user/profile?access_token=' + accessToken

    if (!_.isNil(cachedAccessToken) && cachedAccessToken === accessToken) {
        logging.debug('cached request: ' + accessToken)
        completeRequest(req, res, 'cached')
    } else {
        request.get({ url: accessURL, json: true }, function(error, response, body) {
            var statusCode = 401

            if (!_.isNil(response) && !_.isNil(response.statusCode)) {
                statusCode = response.statusCode
            }
            if (statusCode !== 200 && !_.isNil(response) || !_.isNil(error)) {
                cachedAccessToken = null
                logging.error('alexa action failed: ' + accessURL, {
                    event: 'access-token-verify-failed',
                    error: error,
                    code: (response && response.statusCode ? response.statusCode : 'none'),
                    body: body,
                    url: accessURL
                })
            }
            const discoveredEmail = body.email
            if (discoveredEmail === alexaEmail) {
                logging.debug('GOOD!')
                cachedAccessToken = accessToken
                logging.debug('caching token: ' + accessToken)
            } else {
                logging.debug('*** BAD EMAIL BAILING ***')
                cachedAccessToken = null
                res.status(401)
                return
            }

            completeRequest(req, res, accessURL)
        })
    }
})

app.listen(listening_port, function() {
    logging.info('Alexa-MQTT Bridge listening on port: ', listening_port)
})