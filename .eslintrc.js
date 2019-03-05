module.exports = {
    "env": {
        "browser": true,
        "es6": true
    },
    "extends": "eslint:recommended",
    "rules": {
        'comma-spacing': [
            "error", 
            { "before": false, "after": true }
        ],
        "space-infix-ops" : 'error',
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "no-console" : 'off',
        "semi": [
            "error",
            "always"
        ],
    }
};
