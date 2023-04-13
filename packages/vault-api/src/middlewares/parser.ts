/* istanbul ignore file */
import express from 'express'

export default [express.json(), express.urlencoded({ extended: false })]
