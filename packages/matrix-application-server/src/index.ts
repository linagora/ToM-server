import { Router } from 'express'

export default class MatrixApplicationServer {
  endpoints: Router

  constructor() {
    this.endpoints = Router()
  }
}
