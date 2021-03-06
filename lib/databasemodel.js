(function() {
	"use strict";

	var __hasProp = {}.hasOwnProperty,
		__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } };

	var _;

	var thunkify = require('fora-node-thunkify'),
		BaseModel = require('./basemodel');


	var DatabaseModel = function (params) {
		BaseModel.call(this, params);
	};


	DatabaseModel.prototype = Object.create(BaseModel.prototype);
	DatabaseModel.prototype.constructor = DatabaseModel;
	__extends(DatabaseModel, BaseModel);



	DatabaseModel.findById = function*(id, context) {
		var query = context.db.setRowId({}, id);
		return yield* this.findOne(query, {}, context);
	};



	DatabaseModel.find = function*(query, options, context) {
		if (arguments.length === 2) {
			context = options;
			options = null;
		}

		var db = context.db, typesService = context.typesService;

		var results;
		var typeDefinition = yield* this.getTypeDefinition(typesService);
		var items = yield* db.find(typeDefinition, query, options);
		if (items.length) {
			results = [];
			for (var _i = 0; _i < items.length; _i++) {
				var item = items[_i];
				results.push(yield* typesService.constructModelFromTypeDefinition(item, typeDefinition));
			}
			return results;
		} else {
			return [];
		}
	};


	DatabaseModel.findOne = function*(query) {
		var options, context;

		if (arguments.length === 2) {
			context = arguments[1];
		} else if (arguments.length === 3) {
			options = arguments[1];
			context = arguments[2];
		}

		var db = context.db, typesService = context.typesService;

		var result, typeDefinition;
		typeDefinition = yield* this.getTypeDefinition(typesService);
		result = yield* db.findOne(typeDefinition, query, options);
		if (result) {
			return yield* typesService.constructModelFromTypeDefinition(result, typeDefinition);
		}
	};


	DatabaseModel.count = function*(query, context) {
		var db = context.db, typesService = context.typesService;

		var typeDefinition = yield* this.getTypeDefinition(typesService);
		return yield* db.count(typeDefinition, query);
	};


	DatabaseModel.destroyAll = function*(query, context) {
		var db = context.db, typesService = context.typesService;

		var typeDefinition = yield* this.getTypeDefinition(typesService);
		if (typeof typeDefinition.canDestroyAll === "function" && typeDefinition.canDestroyAll(query)) {
			return yield* db.remove(typeDefinition, query);
		} else {
			throw new Error("Call to destroyAll must pass safety checks on query.");
		}
	};


	DatabaseModel.prototype.save = function*(context) {
		var db = context.db, typesService = context.typesService;

		var typeDefinition = yield* this.getTypeDefinition(typesService);
		if (typeDefinition.autoGenerated) {
			for (var fieldName in typeDefinition.autoGenerated) {
				var def = typeDefinition.autoGenerated[fieldName];
				switch (def.event) {
					case 'created':
						if (!db.getRowId(this)) {
							this[fieldName] = Date.now();
						}
						break;
					case 'updated':
						this[fieldName] = Date.now();
				}
			}
		}

		var errors = yield* this.validate(typesService);
		if (!errors.length) {
			if (db.getRowId(this) && (typeDefinition.concurrency === 'optimistic' || !typeDefinition.concurrency)) {
				var _item = yield* this.constructor.findById(db.getRowId(this), context);
				if (_item.__updateTimestamp !== this.__updateTimestamp) {
					throw new Error("Update timestamp mismatch. Was " + _item.__updateTimestamp + " in saved, " + this.__updateTimestamp + " in new.");
				}
			}

			this.__updateTimestamp = Date.now();
			this.__shard = typeDefinition.generateShard ? typeDefinition.generateShard(this) : "1";

			var result;
			if (!db.getRowId(this)) {
				if (typeDefinition.logging && typeDefinition.logging.onInsert) {
					var insertEvent = {
						type: typeDefinition.logging.onInsert,
						data: this
					};
					db.insert('events', insertEvent);
				}
				result = yield* db.insert(typeDefinition, this);
				result = yield* typesService.constructModelFromTypeDefinition(result, typeDefinition);
			} else {
				if (typeDefinition.logging && typeDefinition.logging.onUpdate) {
					var updateEvent = {
						type: typeDefinition.logging.onUpdate,
						data: this
					};
					db.insert('events', updateEvent);
				}
				var query = db.setRowId({}, db.getRowId(this));
				_ = yield* db.update(typeDefinition, query, this);
				result = this;
			}
			return result;

		} else {
			var details;

			if (db.getRowId(this)) {
				details = "Invalid record with id " + (db.getRowId(this)) + " in " + typeDefinition.collection + ".";
			} else {
				details = "Validation failed while creating a new entry in " + typeDefinition.collection + ".";
			}

			details += " " + errors.length + " errors generated at " + (Date().toString('yyyy-MM-dd'));
			details = details + ": " + (errors.join(', ')) + ".";

			throw new Error("Model failed validation. " + details);
		}
	};


	DatabaseModel.prototype.destroy = function*(context) {
		var db = context.db, typesService = context.typesService;

		var typeDefinition = yield* this.getTypeDefinition(typesService);
		var query = db.setRowId({}, db.getRowId(this));
		return db.remove(typeDefinition, query);
	};


	DatabaseModel.prototype.link = function*(name, context) {
		var db = context.db, typesService = context.typesService;

		var query, result, _i, _j;

		var typeDef = yield* this.getTypeDefinition(typesService);
		var link = typeDef.links[name];
		var otherTypeDef = yield* typesService.getTypeDefinition(link.type);
		if (link.key) {
			//#this handles keys of the type [{credentialId: _id}, {username: username}]
			if (typeof link.key === 'string') {
				switch (typeDef.schema.properties[link.key].type) {
					case 'string':
						return yield* otherTypeDef.ctor.findById(this[link.key], context);
					case 'array':
						throw new Error("Array keys are not implemented");
				}
			} else if (link.key instanceof Array) {
				query = {};
				link.key.forEach(function(key) {
					for(var keyFrom of key) {
						var keyTo = key[keyFrom];
						query[keyTo] = this[keyFrom];
					}
				}, this);
				return yield* otherTypeDef.ctor.findOne(query, context);
			} else {
				throw new Error("Cannot parse this key");
			}

		} else if (link.field) {
			//handles keys of the type [{credentialId: _id}, {username: username}]
			if (typeof link.field === 'string') {
				switch (otherTypeDef.schema.properties[link.field].type) {
					case 'string':
						var params = {};
						params["" + link.field] = db.getRowId(this);
						result = yield* otherTypeDef.ctor.find(params, context);
						if (link.multiplicity === "one") {
							if (result.length) {
								return result[0];
							}
						} else {
							return result;
						}
						break;
					case 'array':
						throw new Error("Array keys are not implemented");
				}
			} else if (link.field instanceof Array) {
				query = {};
				link.field.forEach(function(field) {
					for(var fieldFrom of field) {
						var fieldTo = field[fieldFrom];
						query[fieldFrom] = this[fieldTo];
					}
				}, this);
				return yield* otherTypeDef.ctor.findOne(query, context);
			} else {
				throw new Error("Cannot parse this key");
			}

		} else {
			throw new Error("Invalid link " + name + " in " + typeDef.name);
		}
	};


	module.exports = DatabaseModel;

})();
