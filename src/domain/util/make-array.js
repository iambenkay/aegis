'use strict'

export default function makeArray (v) {
  return Array.isArray(v) ? v : [v]
}
