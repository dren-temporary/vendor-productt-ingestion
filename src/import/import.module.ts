import { Module } from '@nestjs/common';
import { ProductIngestionService } from './product-ingestion.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductSchema } from './schemas/product.schema';
import { VendorSchema } from './schemas/vendor.schema';
import { ManufacturerSchema } from './schemas/manufacturer.schema';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Product', schema: ProductSchema },
      { name: 'Vendor', schema: VendorSchema },
      { name: 'Manufacturer', schema: ManufacturerSchema },
    ]),
    HttpModule,
  ],
  providers: [ProductIngestionService],
})
export class ImportModule {}
