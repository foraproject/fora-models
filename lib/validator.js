(function() {

	var TypesUtil = require('./types-util');
	var typesUtil = new TypesUtil();

	var Validator = function(typesService) {
		this.typesService = typesService;
	};


	Validator.prototype.validate = function*(obj, typeDefinition) {
		var customValidationResults, def, field, fieldName, _i;

		var errors = [];

		for (fieldName in typeDefinition.schema.properties) {
			def = typeDefinition.schema.properties[fieldName];
			this.addError(errors, fieldName, yield* this.validateField(obj, obj[fieldName], fieldName, def));
		}

		if (typeDefinition.schema.required && typeDefinition.schema.required.length) {
			for (_i = 0; _i < typeDefinition.schema.required; _i++) {
				field = typeDefinition.schema.required[_i];
				if (typeof obj[field] === 'undefined') {
					errors.push(field + " is required");
				}
			}
		}

		if (typeDefinition.validate) {
			customValidationResults = yield* typeDefinition.validate.call(obj);
			if (customValidationResults && customValidationResults.length) {
				return errors.concat(customValidationResults);
			} else {
				return errors;
			}
		} else {
			return errors;
		}
	};


	Validator.prototype.validateField = function*(obj, value, fieldName, fieldDef) {
		var errors, item, typeCheck, _i, _len;
		errors = [];
		if (value !== null) {
			if (fieldDef.type === 'array') {
				if (fieldDef.minItems && value.length < fieldDef.minItems) {
					errors.push("" + fieldName + ": must have at least " + fieldDef.minItems + " elements");
				}
				if (fieldDef.maxItems && value.length > fieldDef.maxItems) {
					errors.push("" + fieldName + ": can have at most " + fieldDef.minItems + " elements");
				}
				for (_i = 0, _len = value.length; _i < _len; _i++) {
					item = value[_i];
					if (typesUtil.isCustomType(fieldDef.items.type)) {
						if (item.validate) {
							errors = errors.concat(yield* item.validate());
						} else if (fieldDef.items.typeDefinition) {
							errors = errors.concat(yield* this.validate(item, fieldDef.items.typeDefinition));
						}
					} else {
						errors = errors.concat(yield* this.validateField(obj, item, "[" + fieldName + "]", fieldDef.items));
					}
				}
			} else {
				typeCheck = function(fn) {
					if (!fn()) {
						return errors.push("" + fieldName + ": expected " + fieldDef.type + " but got " + (JSON.stringify(value)));
					}
				};
				switch (fieldDef.type) {
					case 'integer':
						typeCheck(function() {
							return value % 1 === 0;
						});
						break;
					case 'number':
						typeCheck(function() {
							return typeof value === 'number';
						});
						break;
					case 'string':
						typeCheck(function() {
							return typeof value === 'string';
						});
						break;
					case 'boolean':
						typeCheck(function() {
							return typeof value === 'boolean';
						});
						break;
					default:
						if (typesUtil.isCustomType(fieldDef.type)) {
							if (value.validate) {
								errors = errors.concat(yield* value.validate());
							} else if (fieldDef.typeDefinition) {
								errors = errors.concat(yield* this.validate(value, fieldDef.typeDefinition));
							}
						}
				}
			}
		}
		return errors;
	};


	Validator.prototype.addError = function(list, fieldName, error) {
		var item, _i, _len;
		if (error === true) {
			return list;
		}
		if (error === false) {
			list.push("" + fieldName + " is invalid.");
			return list;
		}
		if (error instanceof Array) {
			if (error.length > 0) {
				for (_i = 0; _i < error.length; _i++) {
					item = error[_i];
					this.addError(list, fieldName, item);
				}
			}
			return list;
		}
		if (error) {
			list.push(error);
			return list;
		}
	};


	module.exports = Validator;

})();
