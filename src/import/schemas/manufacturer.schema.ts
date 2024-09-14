import { Schema, Document } from 'mongoose';

export interface ManufacturerDocument extends Document {
  manufacturerId: string;
  name: string;
}
export const ManufacturerSchema = new Schema<ManufacturerDocument>({
  manufacturerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
});
