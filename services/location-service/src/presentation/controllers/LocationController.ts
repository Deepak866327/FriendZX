import { Request, Response } from 'express';
import { UpdateLocationUseCase } from '../../application/usecases/UpdateLocationUseCase';
import { GetNearbyUseCase } from '../../application/usecases/GetNearbyUseCase';
import { SearchLocationsUseCase } from '../../application/usecases/SearchLocationsUseCase';
import { GetLocationHistoryUseCase } from '../../application/usecases/GetLocationHistoryUseCase';
import { Logger } from '../../../../../shared/utils/logger';
import { UpdateLocationDTO } from '../../application/dto/LocationDTO';

const logger = new Logger('LocationController');

export class LocationController {
  constructor(
    private updateLocationUseCase: UpdateLocationUseCase,
    private getNearbyUseCase: GetNearbyUseCase,
    private searchLocationsUseCase: SearchLocationsUseCase,
    private getLocationHistoryUseCase: GetLocationHistoryUseCase
  ) {}

  async updateLocation(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const locationData: UpdateLocationDTO = req.body;

      if (!locationData.latitude || !locationData.longitude) {
        return res.status(400).json({ error: 'Latitude and longitude required' });
      }

      const result = await this.updateLocationUseCase.execute(userId, locationData);
      res.json(result);
    } catch (error) {
      logger.error(`Update location error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getNearby(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const radius = parseInt(req.query.radius as string) || 200;
      const limit = parseInt(req.query.limit as string) || 50;

      const nearbyUsers = await this.getNearbyUseCase.execute(userId, radius, limit);
      res.json({ nearby: nearbyUsers, count: nearbyUsers.length });
    } catch (error) {
      logger.error(`Get nearby error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async searchLocations(req: Request, res: Response) {
    try {
      const address = req.query.address as string;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!address) {
        return res.status(400).json({ error: 'Address query parameter required' });
      }

      const results = await this.searchLocationsUseCase.execute(address, limit);
      res.json({ results, count: results.length });
    } catch (error) {
      logger.error(`Search locations error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await this.getLocationHistoryUseCase.execute(userId, limit, offset);
      res.json({ history, limit, offset, count: history.length });
    } catch (error) {
      logger.error(`Get history error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getLocation(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      res.json({
        message: 'Get current location - implement with repository',
        userId,
      });
    } catch (error) {
      logger.error(`Get location error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async clearHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      res.json({
        message: 'Clear history - implement with repository',
        userId,
      });
    } catch (error) {
      logger.error(`Clear history error: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
