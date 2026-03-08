import { Request, Response } from 'express';
import Settings from '../models/Settings';

// Returns the organisation's settings; auto-creates a defaults document if none exists
export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    let settings = await Settings.findOne();

    // Bootstrap default settings on first run so the app always has a valid config
    if (!settings) settings = await Settings.create({});

    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Updates the organisation's settings; creates the document if it doesn't yet exist
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      // First-time setup — create the settings document with the provided values
      settings = await Settings.create(req.body);
    } else {
      // Merge incoming fields into the existing settings document
      Object.assign(settings, req.body);
      await settings.save();
    }

    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};