const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CompressionPlugin = require('compression-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const { DefinePlugin } = require('webpack');
const dotenv = require('dotenv');

// Load environment variables
const env = dotenv.config().parsed || {};
const envKeys = Object.keys(env).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(env[next]);
  return prev;
}, {});

// Environment flags
const isDev = process.env.NODE_ENV === 'development';
const isAnalyze = process.env.ANALYZE === 'true';

module.exports = {
  mode: isDev ? 'development' : 'production',
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isDev ? '[name].js' : '[name].[contenthash].js',
    chunkFilename: isDev ? '[name].chunk.js' : '[name].[contenthash].chunk.js',
    publicPath: '/',
    clean: true
  },
  devtool: isDev ? 'eval-source-map' : 'source-map',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  optimization: {
    minimize: !isDev,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: !isDev,
            drop_debugger: !isDev
          }
        }
      }),
      new CssMinimizerPlugin()
    ],
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 20,
      maxAsyncRequests: 30,
      minSize: 20000,
      cacheGroups: {
        // Extract React into its own bundle
        framework: {
          name: 'framework',
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types)[\\/]/,
          priority: 40,
          chunks: 'all',
          enforce: true
        },
        // Group major libraries together
        lib: {
          name: 'lib',
          test: /[\\/]node_modules[\\/](axios|lodash|date-fns)[\\/]/,
          priority: 30,
          chunks: 'all'
        },
        // UI libraries bundle
        ui: {
          name: 'ui',
          test: /[\\/]node_modules[\\/](react-bootstrap|react-select|react-table)[\\/]/,
          priority: 20,
          chunks: 'all'
        },
        // Common reused modules
        commons: {
          name: 'commons',
          minChunks: 2,
          priority: 10,
          chunks: 'all',
          reuseExistingChunk: true
        },
        // Default vendors rule
        vendors: {
          name: 'vendors',
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          chunks: 'all',
          reuseExistingChunk: true
        },
        // Default rule
        default: {
          minChunks: 1,
          priority: -20,
          reuseExistingChunk: true
        }
      }
    }
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: isDev
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      {
        test: /\.s[ac]ss$/,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader'
        ]
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 10 * 1024 // 10kb
          }
        },
        generator: {
          filename: 'images/[name].[hash][ext][query]'
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name].[hash][ext][query]'
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      favicon: './public/favicon.ico',
      minify: !isDev
    }),
    new DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      ...envKeys
    }),
    new MiniCssExtractPlugin({
      filename: isDev ? '[name].css' : '[name].[contenthash].css',
      chunkFilename: isDev ? '[id].css' : '[id].[contenthash].css'
    }),
    new WebpackManifestPlugin({
      fileName: 'asset-manifest.json'
    }),
    ...(isDev ? [] : [
      new CompressionPlugin({
        test: /\.(js|css|html|svg)$/,
        algorithm: 'gzip',
        threshold: 10240, // Only compress assets > 10kb
        minRatio: 0.8
      })
    ]),
    ...(isAnalyze ? [
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        reportFilename: path.resolve(__dirname, 'reports/bundle-report.html'),
        openAnalyzer: false,
        generateStatsFile: true,
        statsFilename: path.resolve(__dirname, 'reports/bundle-stats.json')
      })
    ] : [])
  ],
  devServer: {
    historyApiFallback: true,
    hot: true,
    open: true,
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000',
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true
      }
    }
  },
  // Performance budget thresholds
  performance: isDev ? false : {
    hints: 'warning',
    maxEntrypointSize: 512000, // 500kb
    maxAssetSize: 512000 // 500kb
  }
};
