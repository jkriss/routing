const debug = require('debug')('nvivn:sign-message')
const multibase = require('multibase')
const { sign } = require('./signing')
const hash = require('./hash')

const signMessage = (message, opts) => {
  if (opts.identity) {
    if (!message.meta) message.meta = {}
    if (!message.meta.signed) {
      message.meta.signed = []
    }
    if (message.meta.signed.find(s => s.publicKey === opts.identity.publicKey)) {
      // already signed
      return
    }
    if (!message.meta.hash) message.meta.hash = hash(message)
    const secretKeyBuffer = multibase.decode(opts.identity.secretKey)
    const t = Date.now()

    const objToSign = {
      hash: message.meta.hash,
      t
    }
    const signature = sign(objToSign, secretKeyBuffer)

    message.meta.signed.push({
      publicKey: opts.identity.publicKey,
      signature,
      t
    })
    debug("signature:", signature)
  }
}

module.exports = {
  signMessage
}