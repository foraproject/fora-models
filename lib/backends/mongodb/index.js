(function() {

	var Mongo = require('mongodb');

	var thunkify = require('fora-node-thunkify');

	var Parser = require('./queryparser');

	var MongoDb = function(conf) {
		this.conf = conf;
	};

	MongoDb.prototype.getDb = function*() {
		var client;
		if (!this.db) {
			client = new Mongo.Db(this.conf.name, new Mongo.Server(this.conf.host, this.conf.port, {}), {
				safe: true
			});
			this.db = yield* thunkify(client.open).call(client);
			this.parser = new Parser(this.conf);
		}
		return this.db;
	};

	MongoDb.prototype.insert = function*(typeDefinition, document) {
		var collection, db, result;
		db = yield* this.getDb();
		collection = yield* thunkify(db.collection).call(db, typeDefinition.collection);
		result = yield* thunkify(collection.insert).call(collection, document, {
			safe: true
		});
		return result[0];
	};

	MongoDb.prototype.update = function*(typeDefinition, query, document) {
		var collection, db;
		db = yield* this.getDb();
		query = this.parser.parse(query, typeDefinition);
		collection = yield* thunkify(db.collection).call(db, typeDefinition.collection);
		return yield* thunkify(collection.update).call(collection, query, document, {
			safe: true,
			multi: false
		});
	};

	MongoDb.prototype.updateAll = function*(typeDefinition, query, document) {
		var collection, db;
		db = yield* this.getDb();
		query = this.parser.parse(query, typeDefinition);
		collection = yield* thunkify(db.collection).call(db, typeDefinition.collection);
		return yield* thunkify(collection.update).call(collection, query, document, {
			safe: true,
			multi: true
		});
	};

	MongoDb.prototype.count = function*(typeDefinition, query) {
		var cursor;
		cursor = yield* this.getCursor(typeDefinition, query);
		return yield* thunkify(cursor.count).call(cursor);
	};

	MongoDb.prototype.find = function*(typeDefinition, query, options) {
		var cursor;
		if (!options) {
			options = {};
		}
		cursor = yield* this.getCursor(typeDefinition, query, options);
		return yield* thunkify(cursor.toArray).call(cursor);
	};

	MongoDb.prototype.findOne = function*(typeDefinition, query, options) {
		var cursor;
		if (!options) {
			options = {};
		}
		cursor = yield* this.getCursor(typeDefinition, query, options);
		return yield* thunkify(cursor.nextObject).call(cursor);
	};

	MongoDb.prototype.remove = function*(typeDefinition, query, options) {
		var collection, db;
		if (!options) {
			options = {};
		}
		db = yield* this.getDb();
		query = this.parser.parse(query, typeDefinition);
		collection = yield* thunkify(db.collection).call(db, typeDefinition.collection);
		return yield* thunkify(collection.remove).call(collection, query, {
			safe: true
		});
	};

	MongoDb.prototype.deleteDatabase = function*() {
		var db;
		db = yield* this.getDb();
		return yield* (thunkify(db.dropDatabase)).call(db);
	};

	MongoDb.prototype.setupIndexes = function*(typeDefinitions) {
		var collection, db, index, name, typeDefinition, _i, _len, _ref;
		db = yield* this.getDb();
		for (name in typeDefinitions) {
			typeDefinition = typeDefinitions[name];
			if (typeDefinition.indexes) {
				collection = yield* thunkify(db.collection).call(db, typeDefinition.collection);
				_ref = typeDefinition.indexes;
				for (_i = 0, _len = _ref.length; _i < _len; _i++) {
					index = _ref[_i];
					_ = yield* thunkify(collection.ensureIndex).call(collection, index);
				}
			}
		}
	};

	MongoDb.prototype.ObjectId = function(id) {
		if (id) {
			if (typeof id === "string") {
				return new Mongo.ObjectID(id);
			} else {
				return id;
			}
		} else {
			return new Mongo.ObjectID();
		}
	};

	MongoDb.prototype.getCursor = function*(typeDefinition, query, options) {
		var collection, cursor, db;
		if (!options) {
			options = {};
		}
		db = yield* this.getDb();
		query = this.parser.parse(query, typeDefinition);
		collection = yield* thunkify(db.collection).call(db, typeDefinition.collection);
		cursor = collection.find(query);
		if (options.sort) {
			cursor = cursor.sort(options.sort);
		}
		if (cursor.limit) {
			cursor = cursor.limit(options.limit);
		}
		return cursor;
	};

	module.exports = MongoDb;

}).call(this);
