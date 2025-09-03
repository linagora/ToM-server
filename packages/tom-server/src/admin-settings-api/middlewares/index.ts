import type { IAdminSettingsMiddleware } from '../types'
import type { Request, Response, NextFunction } from 'express'
import type { Config } from '@twake/server/src/types'
import type { TwakeLogger } from '@twake/logger'

export default class AdminSettingsMiddleware
    implements IAdminSettingsMiddleware {
    constructor(
        private readonly config: Config,
        private readonly logger: TwakeLogger
    ) { }

    /**
     * Checks the access token for the admin settings
     *
     * @param {Request} req - the request
     * @param {Response} res - the response
     * @param {NextFunction} next - the next function
     */
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    checkAdminSettingsToken = (req: Request, res: Response, next: NextFunction) => {
        const token = this.config.synapse_admin_secret;
        const authHeader = req.headers.authorization;

        if ((authHeader == null) || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const receivedToken = authHeader.slice(7); // remove "Bearer "
        if (receivedToken !== token) {
            return res.status(403).json({ error: 'Forbidden: invalid token' });
        }

        next();
    }
}
