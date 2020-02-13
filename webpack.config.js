const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const StringReplacePlugin = require("string-replace-webpack-plugin");

const isProduction = process.env.NODE_ENV === 'production';

const babelConf = {
    loader: 'babel-loader',
    options: {
        presets: [
            [
                "@babel/preset-env",
                {
                    targets: {
                        "ie": "11"
                    },
                    modules: false,
                    useBuiltIns: 'usage',
                    corejs: "core-js@2",
                    loose: true
                }
            ]
        ],
        sourceType: "unambiguous",
        ignore: [
            /\/core-js/,
        ]
    }
};

module.exports = {
    entry: {
        home: './assets/home.js',
        arbreomatic: './assets/arbreomatic.js',
        insee: './assets/insee.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: './js/[name].bundle.js',
    },
    // Generate sourcemaps for proper error messages
    devtool: isProduction ? undefined : 'source-map',
    performance: {
        // Turn off size warnings for entry points
        hints: false,
    },
    resolve: {
        alias: {
            fs: 'pdfkit/js/virtual-fs.js'
        }
    },
    module: {
        rules: [
            {
                enforce: 'pre',
                test: /\.js$/,
                exclude: /node_modules/,
                use: babelConf
            },
            {
                test: /\.js$/,
                include: /(pdfkit|saslprep|unicode-trie|unicode-properties|dfa|linebreak|panzoom)/,
                use: babelConf
            },

            {enforce: 'post', test: /fontkit[/\\]index.js$/, loader: "transform-loader?brfs"},
            {enforce: 'post', test: /unicode-properties[/\\]index.js$/, loader: "transform-loader?brfs"},
            {enforce: 'post', test: /linebreak[/\\]src[/\\]linebreaker.js/, loader: "transform-loader?brfs"},
            {test: /src[/\\]assets/, loader: 'arraybuffer-loader'},
            {test: /\.afm$/, loader: 'raw-loader'},

            {
                test: /\.(html)$/,
                loader: 'html-loader',
                options: {
                    interpolate: true, // Interpolation syntax for ES6 template strings
                    minimize: false, // Disable minifcation during production mode
                },
                exclude: /node_modules/,
            },
            {
                test: /\.(css|sass|scss)$/,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader,
                        options: {
                            publicPath: '../',
                        }
                    },
                    {
                        loader: 'css-loader',
                        options: {
                            importLoaders: 2,
                            sourceMap: true
                        }
                    },
                    {
                        loader: 'resolve-url-loader',
                    },
                    {
                        loader: 'postcss-loader',
                        options: {
                            plugins: () => [
                                require('autoprefixer')
                            ],
                            sourceMap: true
                        }
                    },
                    {
                        loader: 'sass-loader',
                        options: {
                            sourceMap: true
                        }
                    },
                ],
                exclude: /node_modules/,
            },

            {
                test: /\.(jpe?g|png|gif|svg)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            outputPath: (url, resourcePath, context) => {
                                const t = true;
                                if (t) {
                                    return url;
                                }
                                else {
                                    return `images/${url}`;
                                }
                            },
                            name: '[name].[ext]',
                        },
                    },
                    {
                        loader: 'image-webpack-loader',
                        options: {
                            disable: process.env.NODE_ENV !== 'production', // Disable during development
                            mozjpeg: {
                                progressive: true,
                                quality: 75
                            },
                        },
                    }
                ],
                exclude: /node_modules/,
            },
            {
                type: 'javascript/auto', // Fix for *.json files
                test: /(favicon\.ico|site\.webmanifest|manifest\.json|browserconfig\.xml|robots\.txt|humans\.txt)$/,
                loader: 'file-loader',
                options: {
                    name: '[name].[ext]',
                },
                exclude: /node_modules/,
            },
            {
                test: /\.(woff(2)?|ttf|eot)(\?[a-z0-9=.]+)?$/,
                loader: 'file-loader',
                options: {
                    outputPath: 'fonts',
                    name: '[name].[ext]',
                },
                exclude: /node_modules/,
            },

            {
                test: /\.js$/,
                loader: StringReplacePlugin.replace({ // Hard patch for `trimLeft`
                    replacements: [
                        {
                            pattern: /trimLeft\(\)/ig,
                            replacement: function (match, p1, offset, string) {
                                return 'trim()';
                            }
                        }
                    ]
                })
            }
        ],
    },

    devServer: {
        contentBase: path.join(__dirname, 'dist'),
        compress: true,
        port: 9000
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './assets/html/index.html',
            filename: 'index.html',
            chunks: ['home'],
            hash: true,
        }),
        new HtmlWebpackPlugin({
            template: './assets/html/arbreomatic/index.html',
            filename: 'arbreomatic/index.html',
            chunks: ['arbreomatic'],
            hash: true,
        }),
        new HtmlWebpackPlugin({
            template: './assets/html/insee/index.html',
            filename: 'insee/index.html',
            chunks: ['insee'],
            hash: true,
        }),
        new MiniCssExtractPlugin({
            filename: './css/[name].css',
        }),
        new StringReplacePlugin()
    ]
};
