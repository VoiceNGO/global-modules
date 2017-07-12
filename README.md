## Global Modules

The idea of this was blatently taken from Facebook's `@providesModule` syntax, so thank's guys!

In short this attempts to get around all the absurd hacks for require paths, like `require('../../../../../foo')`, or hijacking require or any of a number of other things and creates a global registry of modules throughout your application.  Facebook does this by creating a `module-map.json` file, but that requires all of your tooling to be module aware or you lose things like code completion, typing, etc.  This does away with `module-map.json` and instead creates symlinks in the nearest `node_modules` directory of each file.  What this allows:

#### file-a.js

```js
// @providesModule foobar
// ... code goes here ...
```

#### file-b.js

```js
import foobar from 'foobar';
```

`file-a.js` and `file-b.js` can be *anywhere* in your project and this will just work since `file-a.js` gets symlinked
as `node_modules/foobar`

### Installation

Requires [watchman](https://facebook.github.io/watchman/), so install that first.  Then create a watch and a trigger to this script:

```sh
> watchman watch ./src
> watchman -- trigger ./src global-modules '**/*.js' -- \
  node ./node_modules/babel-cli/bin/babel-node.js ./modules/global-modules
```

The babel nonsense is because I'm still working on this and running it through babel-cli.  I'll clean it up soon, sorry!

That's it!  Throw in a comment with `@providesModule moduleName` into your modules and start requiring them from anywhere
