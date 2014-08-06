(function() {
    "option strict";

    var ValidationError = function(message, details) {
        Error.apply(this, message);
        this.details = details;
    };

    ValidationError.prototype = Object.create(Error.prototype);
    ValidationError.prototype.constructor = ValidationError;

    module.exports = ValidationError;
})();
