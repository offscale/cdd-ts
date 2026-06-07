const fs = require('fs');
let code = fs.readFileSync('bin/cdd-ts.js', 'utf8');

// Replace isUnreserved
code = code.split(
  "const isUnreserved = RegExp.prototype.test.bind(/^[\\da-z\\-._~]$/iu);"
).join(
  "const isUnreserved = RegExp.prototype.test.bind(/^[\\da-z._~-]$/iu);"
);

// Replace isPathCharacter
code = code.split(
  "const isPathCharacter = RegExp.prototype.test.bind(/^[\\da-z\\-._~!$&'()*+,;=:@/]$/iu);"
).join(
  "const isPathCharacter = RegExp.prototype.test.bind(/^[\\da-z._~!$&'()*+,;=:@/-]$/iu);"
);

// Replace nonSimpleDomain
code = code.split(
  "const nonSimpleDomain = RegExp.prototype.test.bind(/[^!\"$&'()*+,\\-.;=_`a-z{}~]/u);"
).join(
  "const nonSimpleDomain = RegExp.prototype.test.bind(/[^!\"$&'()*+,-.;=_`a-z{}~]/u);"
);

// Replace URN_REG
code = code.split(
  "/([\\da-z][\\d\\-a-z]{0,31}):((?:[\\w!$'()*+,\\-.:;=@]|%[\\da-f]{2})+)/iu"
).join(
  "/([\\da-z][\\da-z-]{0,31}):((?:[\\w!$'()*+,-.:;=@]|%[\\da-f]{2})+)/iu"
);

fs.writeFileSync('bin/cdd-ts.js', code);
