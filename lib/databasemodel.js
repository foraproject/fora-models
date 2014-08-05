(function() {
	var __hasProp = {}.hasOwnProperty,
		__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } };

	var _;

	var thunkify = require('fora-node-thunkify');
	var utils = require('./utils');
	var TypesUtil = require('./types-util');
	var typesUtil = new TypesUtil();
	var BaseModel = require('./basemodel');


	//Constructor
	var DatabaseModel = function (params) {
		BaseModel.apply(this, arguments);
	};
	DatabaseModel.prototype = Object.create(BaseModel.prototype);
	DatabaseModel.prototype.constructor = DatabaseModel;
	__extends(DatabaseModel, BaseModel);


	DatabaseModel.get = function*(query, context, typesService, db) {
		var typeDefinition = yield* this.getTypeDefinition();
		var result = yield* db.findOne(typeDefinition, query);
		if (result) {
			return yield* this.constructModel(result, typeDefinition, context, typesService, db);
		}
	};


	DatabaseModel.getAll = function*(query, context, typesService, db) {
		var item, items, typeDefinition, _i, _len, _results;
		typeDefinition = yield* this.getTypeDefinition();
		items = yield* db.find(typeDefinition, query);
		if (items.length) {
			_results = [];
			for (_i = 0, _len = items.length; _i < _len; _i++) {
				item = items[_i];
				_results.push(yield* this.constructModel(item, typeDefinition, context, typesService, db));
			}
			return _results;
		} else {
			return [];
		}
	};


	DatabaseModel.find = function*(query, options, context, typesService, db) {
		var item, items, typeDefinition, _i, _len, _results;
		typeDefinition = yield* this.getTypeDefinition();
		items = yield* db.find(typeDefinition, query, options);
		if (items.length) {
			_results = [];
			for (_i = 0, _len = items.length; _i < _len; _i++) {
				item = items[_i];
				_results.push(yield* this.constructModel(item, typeDefinition, context, typesService, db));
			}
			return _results;
		} else {
			return [];
		}
	};


	DatabaseModel.findOne = function*(query, options, context, typesService, db) {
		var result, typeDefinition;
		typeDefinition = yield* this.getTypeDefinition();
		result = yield* db.findOne(typeDefinition, query, options);
		if (result) {
			return yield* this.constructModel(result, typeDefinition, context, typesService, db);
		}
	};


	DatabaseModel.count = function*(query, context, typesService, db) {
		var typeDefinition;
		typeDefinition = yield* this.getTypeDefinition();
		return yield* db.count(typeDefinition, query);
	};


	DatabaseModel.getById = function*(id, context, typesService, db) {
		var query, result, typeDefinition;
		typeDefinition = yield* this.getTypeDefinition();
		query = db.setRowId({}, id);
		result = yield* db.findOne(typeDefinition, query);
		if (result) {
			return yield* this.constructModel(result, typeDefinition, context, typesService, db);
		}
	};


	DatabaseModel.destroyAll = function*(query, db) {
		var typeDefinition;
		typeDefinition = yield* this.getTypeDefinition();
		if (typeof typeDefinition.canDestroyAll === "function" ? typeDefinition.canDestroyAll(query) : void 0) {
			return yield* db.remove(typeDefinition, query);
		} else {
			throw new Error("Call to destroyAll must pass safety checks on query.");
		}
	};


	var attachSystemFields = function(model, context, typesService, db) {
		if (model instanceof DatabaseModel) {
			model.__context = context;
			model.__typesService = typesService;
			model.__db = db;
			return model.__db;
		}
	};


	var detachSystemFields = function(model) {
		if (model instanceof DatabaseModel) {
			model.__context = void 0;
			model.__typesService = void 0;
			model.__db = void 0;
			return model.__db;
		}
	};


	var makeResult = function*(obj, fnConstructor, typeDefinition, context, typesService, db) {
		var result;
		result = yield* fnConstructor(obj, context, typesService, db);
		attachSystemFields(result, context, typesService, db);
		return result;
	};


	DatabaseModel.constructModel = function*(obj, typeDefinition, context, typesService, db) {
		var clone, effectiveTypeDef, original, result;
		if (typeDefinition.discriminator) {
			effectiveTypeDef = yield* typeDefinition.discriminator(obj);
		} else {
			effectiveTypeDef = typeDefinition;
		}
		result = yield* this._constructModel_impl(obj, effectiveTypeDef, context, typesService, db);
		if (effectiveTypeDef.trackChanges) {
			clone = utils.deepCloneObject(obj);
			original = yield* this._constructModel_impl(clone, effectiveTypeDef, context, typesService, db);
			result.getOriginalModel = function() {
				return original;
			};
		}
		if (effectiveTypeDef !== typeDefinition) {
			result.getTypeDefinition = function*() {
				return effectiveTypeDef;
			};
			if (effectiveTypeDef.trackChanges) {
				original.getTypeDefinition = function*() {
					return effectiveTypeDef;
				};
			}
		}
		if (typeDefinition.initialize) {
			_ = yield* typeDefinition.initialize(result);
		}
		return result;
	};


	DatabaseModel._constructModel_impl = function*(obj, typeDefinition, context, typesService, db) {
		var fnCtor, result;
		if (typeDefinition.customConstructor) {
			fnCtor = function*(_o, _context, _typesService, _db) {
				return yield* typeDefinition.customConstructor(_o, _context, _typesService, _db);
			};
			return yield* makeResult(obj, fnCtor, typeDefinition, context, typesService, db);
		} else {
			result = yield* this.constructModelFields(obj, typeDefinition, context, typesService, db);
			fnCtor = function*(_o, _context, _typesService, _db) {
				if (typeDefinition.ctor) {
					return new typeDefinition.ctor(_o, _context, _typesService, _db);
				} else {
					return _o;
				}
			};
			return yield* makeResult(result, fnCtor, typeDefinition, context, typesService, db);
		}
	};


	DatabaseModel.constructModelFields = function*(obj, typeDefinition, context, typesService, db) {
		var arr, def, fieldName, item, name, result, value, _i, _len, _ref, _ref1;
		result = {};
		_ref = typeDefinition.schema.properties;
		for (name in _ref) {
			def = _ref[name];
			value = obj[name];
			if (typesUtil.isPrimitiveType(def.type)) {
				if (value !== null) {
					if (def.type === 'array') {
						arr = [];
						if (def.items.typeDefinition) {
							for (_i = 0, _len = value.length; _i < _len; _i++) {
								item = value[_i];
								arr.push(yield* this.constructModel(item, def.items.typeDefinition, context, typesService, db));
							}
						} else {
							arr = value;
						}
						result[name] = arr;
					} else {
						result[name] = value;
					}
				}
			} else {
				if (def.typeDefinition) {
					if (value) {
						result[name] = yield* this.constructModel(value, def.typeDefinition, context, typesService, db);
					}
				} else {
					result[name] = value;
				}
			}
		}
		if (typeDefinition.autoGenerated) {
			_ref1 = typeDefinition.autoGenerated;
			for (fieldName in _ref1) {
				def = _ref1[fieldName];
				result[fieldName] = obj[fieldName];
			}
		}
		if (db.getRowId(obj)) {
			db.setRowId(result, db.getRowId(obj));
		}
		return result;
	};


	DatabaseModel.prototype.create = function() {
		if (!db.getRowId(this)) {
			return this.save.apply(this, arguments);
		} else {
			throw new Error("Cannot create. RowId is not empty");
		}
	};


	DatabaseModel.prototype.save = function*(context, typesService, db) {
		var def, details, error, errors, event, fieldName, query, result, typeDefinition, _item, _ref, _ref1, _ref2;
		if (!context) {
			context = this.__context;
		}
		if (!db) {
			db = this.__db;
		}
		detachSystemFields(this);
		typeDefinition = yield* this.getTypeDefinition();
		if (typeDefinition.autoGenerated) {
			_ref = typeDefinition.autoGenerated;
			for (fieldName in _ref) {
				def = _ref[fieldName];
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
		errors = yield* this.validate(typesService);
		if (!errors.length) {
			if (db.getRowId(this) && (typeDefinition.concurrency === 'optimistic' || !typeDefinition.concurrency)) {
				_item = yield* this.constructor.getById(db.getRowId(this), context, typesService, db);
				if (_item.__updateTimestamp !== this.__updateTimestamp) {
					throw new Error("Update timestamp mismatch. Was " + _item.__updateTimestamp + " in saved, " + this.__updateTimestamp + " in new.");
				}
			}
			this.__updateTimestamp = Date.now();
			this.__shard = typeDefinition.generateShard !== null ? typeDefinition.generateShard(this) : "1";
			if (!db.getRowId(this)) {
				if ((_ref1 = typeDefinition.logging) !== null ? _ref1.onInsert : void 0) {
					event = {
						type: typeDefinition.logging.onInsert,
						data: this
					};
					db.insert('events', event);
				}
				result = yield* db.insert(typeDefinition, this);
				result = yield* this.constructor.constructModel(result, typeDefinition, context, typesService, db);
			} else {
				if ((_ref2 = typeDefinition.logging) !== null ? _ref2.onUpdate : void 0) {
					event = {
						type: typeDefinition.logging.onUpdate,
						data: this
					};
					db.insert('events', event);
				}
				query = db.setRowId({}, db.getRowId(this));
				_ = yield* db.update(typeDefinition, query, this);
				attachSystemFields(this, context, typesService, db);
				result = this;
			}
			return result;
		} else {
			if (db.getRowId(this)) {
				details = "Invalid record with id " + (db.getRowId(this)) + " in " + typeDefinition + ".\n";
			} else {
				details = "Validation failed while creating a new record in " + typeDefinition + ".\n";
			}
			details += "" + errors.length + " errors generated at " + (Date().toString('yyyy-MM-dd'));
			details = "" + details + ": " + (errors.join(', '));
			error = new Error("Model failed validation: " + details);
			error.details = details;
			throw error;
		}
	};


	DatabaseModel.prototype.destroy = function*(context, typesService, db) {
		var query, typeDefinition;
		if (!context) {
			context = this.__context;
		}
		if (!db) {
			db = this.__db;
		}
		if (!context || !db) {
			throw new Error("Invalid context or db");
		}
		typeDefinition = yield* this.getTypeDefinition();
		query = db.setRowId({}, db.getRowId(this));
		return db.remove(typeDefinition, query);
	};


	DatabaseModel.prototype.link = function*(name, context, typesService, db) {
		var k, link, otherTypeDef, params, query, result, typeDef, v, _i, _j, _len, _len1, _ref, _ref1, _ref2, _ref3, _ref4;
		_ref = this.getContext(context, typesService, db);
		context = _ref.context;
		db = _ref.db;
		typeDef = yield* this.getTypeDefinition();
		link = typeDef.links[name];
		otherTypeDef = yield* typesService.getTypeDefinition(link.type);
		if (link.key) {
			if (typeof link.key === 'string') {
				switch (typeDef.schema.properties[link.key].type) {
					case 'string':
						return yield* otherTypeDef.ctor.getById(this[link.key], context, typesService, db);
					case 'array':
						throw new Error("Array keys are not implemented");
				}
			} else if (link.key instanceof Array) {
				query = {};
				_ref1 = link.key;
				for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
					_ref2 = _ref1[_i];
					k = _ref2.k;
					v = _ref2.v;
					query[v] = this[k];
				}
				return yield* otherTypeDef.ctor.get(query, context, typesService, db);
			} else {
				throw new Error("Cannot parse this key");
			}
		} else if (link.field) {
			if (typeof link.field === 'string') {
				switch (otherTypeDef.schema.properties[link.field].type) {
					case 'string':
						params = {};
						params["" + link.field] = db.getRowId(this);
						result = yield* otherTypeDef.ctor.getAll(params, context, typesService, db);
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
				_ref3 = link.field;
				for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
					_ref4 = _ref3[_j];
					k = _ref4.k;
					v = _ref4.v;
					query[k] = this[v];
				}
				return yield* otherTypeDef.ctor.get(query, context, typesService, db);
			} else {
				throw new Error("Cannot parse this key");
			}
		} else {
			throw new Error("Invalid link " + name + " in " + typeDef.name);
		}
	};


	DatabaseModel.prototype.bindContext = function(__context, __typesService, __db) {
		this.__context = __context;
		this.__typesService = __typesService;
		this.__db = __db;
	};


	DatabaseModel.prototype.getContext = function(context, typesService, db) {
		return {
			context: context !== null ? context : this.__context,
			typesService: typesService !== null ? typesService : this.__typesService,
			db: db !== null ? db : this.__db
		};
	};


	module.exports = DatabaseModel;

})();
