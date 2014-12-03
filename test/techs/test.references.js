var path = require('path'),
    FileSystem = require('enb/lib/test/mocks/test-file-system'),
    TestNode = require('enb/lib/test/mocks/test-node'),
    levelsTech = require('enb-bem-techs/techs/levels'),
    depsTech = require('enb-bem-techs/techs/deps'),
    filesTech = require('enb-bem-techs/techs/files'),
    referencesTech = require('../../lib/techs/references');

describe('techs', function () {
    describe('references', function () {
        var fileSystem,
            bundles = {},
            levels = {},
            levelSchemes = [
                levelScheme('empty', []),
                levelScheme('only-bemjson', [{ file: '?.bemjson.js', content: '({ block: \'one\' })' }]),
                levelScheme('only-html', [{ file: '?.html', content: '<html>one</html>' }]),
                levelScheme('fully', [
                    { file: '?.bemjson.js', content: '({ block: \'fully\' })' },
                    { file: '?.html', content: '<html>fully</html>' }
                ])
            ],
            overrideLevelSchemes = [
                levelScheme('override-bemjson', [{ file: 'only-bemjson.bemjson.js', content: '({ block: \'two\' })' }],
                    'only-bemjson'),
                levelScheme('override-html', [{ file: 'only-html.html', content: '<html>two</html>' }], 'only-html')
            ],
            bundleSchemes = [
                bundleScheme('empty'),
                bundleScheme('only-bemjson'),
                bundleScheme('only-html'),
                bundleScheme('override-bemjson', 'only-bemjson'),
                bundleScheme('override-html', 'only-html'),
                bundleScheme('fully')
            ];

        beforeEach(function () {
            fileSystem = new FileSystem([].concat(levelSchemes, overrideLevelSchemes, bundleSchemes));
            fileSystem.setup();

            levelSchemes.forEach(function (level) {
                levels[level.directory] = [path.join(fileSystem._root, level.directory)];
            });

            overrideLevelSchemes.forEach(function (level) {
                var oldLevel = level.directory.replace('override', 'only');

                levels[level.directory] = [
                    path.join(fileSystem._root, oldLevel),
                    path.join(fileSystem._root, level.directory)
                ];
            });

            bundleSchemes.forEach(function (bundle) {
                bundles[bundle.directory] = new TestNode(bundle.directory);
            });
        });

        afterEach(function () {
            fileSystem.teardown();
        });

        it('must provide empty references', function (done) {
            runBaseTechs('empty')
                .spread(function (res) {
                    res.must.be.eql({});
                })
                .then(done, done);
        });

        it('must provide bemjson reference', function (done) {
            runBaseTechs('only-bemjson')
                .spread(function (res) {
                    res.must.be.eql({
                        'only-bemjson': {
                            bemjson: { block: 'one' }
                        }
                    });
                })
                .then(done, done);
        });

        it('must provide html reference', function (done) {
            runBaseTechs('only-html')
                .spread(function (res) {
                    res.must.be.eql({
                        'only-html': {
                            html: '<html>one</html>'
                        }
                    });
                })
                .then(done, done);
        });

        it('must provide bemjson references', function (done) {
            runBaseTechs('override-bemjson')
                .spread(function (res) {
                    res.must.be.eql({
                        'only-bemjson': {
                            bemjson: { block: 'two' }
                        }
                    });
                })
                .then(done, done);
        });

        it('must provide html references', function (done) {
            runBaseTechs('override-html')
                .spread(function (res) {
                    res.must.be.eql({
                        'only-html': {
                            html: '<html>two</html>'
                        }
                    });
                })
                .then(done, done);
        });

        it('must must provide fully references', function (done) {
            runBaseTechs('fully')
                .spread(function (res) {
                    res.must.be.eql({
                        fully: {
                            bemjson: { block: 'fully' },
                            html: '<html>fully</html>'
                        }
                    });
                })
                .then(done, done);
        });

        function runBaseTechs(name) {
            var bundle = bundles[name + '.bundle'];

            return bundle.runTech(levelsTech, { levels: levels[name + '.blocks'] })
                .then(function (levels) {
                    bundle.provideTechData('?.levels', levels);

                    return bundle.runTechAndRequire(depsTech);
                })
                .spread(function (res) {
                    bundle.provideTechData('?.deps.js', res);

                    return bundle.runTechAndGetResults(filesTech);
                })
                .then(function (res) {
                    var dirsTarget = name + '.bundle.dirs',
                        dirs = res[dirsTarget];

                    bundle.provideTechData('?.dirs', dirs);

                    return bundle.runTechAndRequire(referencesTech);
                });
        }
    });
});

function levelScheme(name, items, blockname) {
    return {
        directory: name + '.blocks',
        items: [
            {
                directory: blockname || name,
                items: [
                    {
                        directory: (blockname || name) + '.tmpl-specs',
                        items: items.map(function (item) {
                            if (item.file) {
                                item.file = unmaskFilename(item.file, name);
                            }

                            if (item.directory) {
                                item.directory = unmaskFilename(item.directory, name);
                            }

                            return item;
                        })
                    }
                ]
            }
        ]
    };
}

function bundleScheme(name, oldName) {
    var nodename = name + '.bundle';

    return {
        directory: nodename,
        items: [
            { file: nodename + '.bemdecl.js', content: stringifyBemdecl([{ name: oldName || name }]) }
        ]
    };
}

function unmaskFilename(filename, levelname) {
    return filename.replace(/\?/g, levelname);
}

function stringifyBemdecl(bemdecl) {
    return 'exports.blocks = ' + JSON.stringify(bemdecl);
}
