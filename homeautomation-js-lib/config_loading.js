const fs = require('fs')
const path = require('path')
const watch = require('watch')
const EventEmitter = require('events')
const yaml = require('js-yaml')
const logging = require('./logging.js')

var configs = []
var config_path = null

module.exports = new EventEmitter()

module.exports.load_path = function(in_path) {
    config_path = in_path
        // Watch Path
    watch.watchTree(config_path, function(f, curr, prev) {
        logging.info('Updating configs')
        load_device_config()
    })
}

module.exports.get_configs = function() {
    return configs
}

module.exports.deviceIterator = function(callback) {
    configs.forEach(function(config_item) {
        Object.keys(config_item).forEach(function(key) {
            callback(key, config_item[key])
        }, this)
    }, this)
}

module.exports.nameForTopic = function(in_topic) {
    var foundName = null

    configs.forEach(function(config_item) {
        if (foundName !== null) return

        Object.keys(config_item).forEach(function(key) {
            if (foundName !== null) return

            const map = config_item[key]
            const topic = map['topic']

            if (topic === in_topic)
                foundName = map['name']

        }, this)
    }, this)

    return foundName
}

module.exports.isVoiceEnabledForTopic = function(in_topic) {
    var foundVoice = false
    var voiceResult = false

    configs.forEach(function(config_item) {
        if (foundVoice === true) return

        Object.keys(config_item).forEach(function(key) {
            if (foundVoice === true) return

            const map = config_item[key]

            const topic = map['topic']
            if (topic === in_topic) {
                if (map['voice_control'] !== undefined)
                    voiceResult = map['voice_control']
                foundVoice = true
            }

        }, this)
    }, this)

    return voiceResult
}

module.exports.translate_to_topic = function(in_topic) {
    var found_topic = null

    configs.forEach(function(config_item) {
        if (found_topic !== null) return

        Object.keys(config_item).forEach(function(key) {
            if (found_topic !== null) return

            const map = config_item[key]
            const src_topic = map['change_topic']

            if (src_topic === in_topic)
                found_topic = map['topic']

        }, this)
    }, this)

    return found_topic
}

module.exports.translate_from_topic = function(in_topic) {
    var found_topic = null

    configs.forEach(function(config_item) {
        if (found_topic !== null) return

        Object.keys(config_item).forEach(function(key) {
            if (found_topic !== null) return

            const map = config_item[key]

            const topic = map['topic']
            const src_topic = map['change_topic']
            if (topic === in_topic)
                found_topic = src_topic

        }, this)
    }, this)

    return found_topic
}

function print_device_config() {
    configs.forEach(function(config_item) {
        Object.keys(config_item).forEach(function(key) {
            logging.debug(' Device [' + key + ']')
            const map = config_item[key]

            const topic = map['topic']
            const src_topic = map['change_topic']
            const voice = map['voice_control']
            const name = map['name']

            logging.debug('            name: ' + name)
            logging.debug('           topic: ' + topic)
            logging.debug('       src_topic: ' + src_topic)
            logging.debug('           voice: ' + voice)
            logging.debug('')

        }, this)
    }, this)
}

function load_device_config() {
    fs.readdir(config_path, function(err, files) {
        configs = []

        logging.info('Loading configs at path: ' + config_path)
        if (err) {
            throw err
        }

        files.map(function(file) {
            return path.join(config_path, file)
        }).filter(function(file) {
            return fs.statSync(file).isFile()
        }).forEach(function(file) {
            logging.info(' - Loading: ' + file)
            const doc = yaml.safeLoad(fs.readFileSync(file, 'utf8'))
            configs.push(doc)
        })

        logging.info('...done loading configs')
        module.exports.emit('config-loaded')
    })
}