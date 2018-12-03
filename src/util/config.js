require('dotenv').config()
const debug = require('debug')('nvivn:config')
const yaml = require('js-yaml')
const fm = require('front-matter')
const fs = require('fs-extra')
const path = require('path')
const userHome = require('user-home')
const { decode } = require('./encoding')
const keys = require('./keys')
const { getConfigDb } = require('./config-db')

const findInfo = async (filename = '.nvivn') => {
  const paths = ['.', userHome]
  for (const p of paths) {
    const filepath = path.join(p, '.nvivn')
    const exists = await fs.exists(filepath)
    if (exists) return filepath
  }
}

const loadConfig = async filename => {
  if (!filename) filename = await findInfo()
  if (!filename) {
    filename = '.nvivn'
    const k = keys.generate()
    const yamlConfig = yaml.safeDump({
      keys: k,
      messageStore: 'file:./messages',
    })
    await fs.writeFile(filename, `---\n${yamlConfig}---\n`)
  }
  let config = {}
  try {
    const infoString = fs.readFileSync(filename, 'utf8')
    frontMattered = fm(infoString)
    let attributes = frontMattered.attributes
    if (
      Object.keys(attributes).length == 0 &&
      frontMattered.body.trim().length > 0
    ) {
      config = yaml.safeLoad(frontMattered.body)
    } else {
      config = frontMattered.attributes
      if (!config.info) config.info = {}
      config.info.greeting = frontMattered.body
    }
  } catch (err) {
    console.error(err)
  }
  if (!config.keys) {
    config.keys = {}
  }
  if (process.env.NVIVN_PUBLIC_KEY) {
    // config.keys.publicKey = decode(process.env.NVIVN_PUBLIC_KEY)
    config.keys.publicKey = process.env.NVIVN_PUBLIC_KEY
    // } else {
    //   config.keys.publicKey = decode(config.keys.publicKey)
  }
  if (process.env.NVIVN_SECRET_KEY) {
    // config.keys.secretKey = decode(process.env.NVIVN_SECRET_KEY)
    config.keys.secretKey = process.env.NVIVN_SECRET_KEY
    // } else {
    //   config.keys.secretKey = decode(config.keys.secretKey)
  }
  const dbFilename = `.nvivn-state/config-${decode(
    config.keys.publicKey
  ).toString('hex')}`
  await fs.ensureDir(path.dirname(dbFilename))
  return getConfigDb({ data: config, dbOpts: { filename: dbFilename } })
}

module.exports = {
  loadConfig,
  getConfigDb,
}

if (require.main === module) {
  loadInfo().then(console.log)
}
