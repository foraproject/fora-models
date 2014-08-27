(function() {
	"use strict";
	
	var _;

	var Mongo = require('mongodb');

	var thunkify = require('fora-node-thunkify');

	var Database = function(conf) {
		var Parser, _ref;
		this.conf = conf;
		switch (this.conf.type) {
			case 'mongodb':
				Parser = require('./backends/mongodb');
				this.db = new Parser(this.conf);
				this.rowId = this.conf.rowId || '_id';
		}
	};

	Database.prototype.getDb = function*() {
		return yield* this.db.getDb();
	};

	Database.prototype.insert = function*(typeDefinition, document) {
		return yield* this.db.insert(typeDefinition, document);
	};

	Database.prototype.update = function*(typeDefinition, query, document) {
		return yield* this.db.update(typeDefinition, query, document);
	};

	Database.prototype.updateAll = function*(typeDefinition, query, document) {
		return yield* this.db.updateAll(typeDefinition, query, document);
	};

	Database.prototype.count = function*(typeDefinition, query) {
		return yield* this.db.count(typeDefinition, query);
	};

	Database.prototype.find = function*(typeDefinition, query, options) {
		return yield* this.db.find(typeDefinition, query, options);
	};

	Database.prototype.findOne = function*(typeDefinition, query, options) {
		return yield* this.db.findOne(typeDefinition, query, options);
	};

	Database.prototype.remove = function*(typeDefinition, query) {
		return yield* this.db.remove(typeDefinition, query);
	};

	Database.prototype.deleteDatabase = function*() {
		return yield* this.db.deleteDatabase();
	};

	Database.prototype.setupIndexes = function*() {
		return yield* this.db.setupIndexes();
	};

	Database.prototype.getRowId = function(obj) {
		return obj[this.rowId] ? obj[this.rowId].toString() : null;
	};

	Database.prototype.setRowId = function(obj, val) {
		if (val) {
			if (typeof val === 'string') {
				val = this.db.ObjectId(val);
			}
			obj[this.rowId] = val;
		}
		return obj;
	};

	module.exports = Database;

}).call(this);
