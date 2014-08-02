Mongo = require 'mongodb'
thunkify = require 'fora-node-thunkify'

class Database

    constructor: (@conf) ->
        switch @conf.type
            when 'mongodb'
                Parser = require('./backends/mongodb')
                @db = new Parser @conf
                @rowId = @conf.rowId ? '_id'


    getDb: =>*
        yield* @db.getDb()



    insert: (typeDefinition, document) =>*
        yield* @db.insert(typeDefinition, document)



    update: (typeDefinition, query, document) =>*
        yield* @db.update(typeDefinition, query, document)



    updateAll: (typeDefinition, query, document) =>*
        yield* @db.updateAll(typeDefinition, query, document)



    count: (typeDefinition, query) =>*
        yield* @db.count(typeDefinition, query)



    find: (typeDefinition, query, options) =>*
        yield* @db.find(typeDefinition, query, options)



    findOne: (typeDefinition, query, options) =>*
        yield* @db.findOne(typeDefinition, query, options)



    remove: (typeDefinition, query) =>*
        yield* @db.remove(typeDefinition, query)



    deleteDatabase: =>*
        yield* @db.deleteDatabase()



    setupIndexes: =>*
        yield* @db.setupIndexes()



    getRowId: (obj) =>
        obj[@rowId]?.toString()



    setRowId: (obj, val) =>
        if val
            if typeof val is 'string'
                val = @db.ObjectId val
            obj[@rowId] = val
        return obj


module.exports = Database
