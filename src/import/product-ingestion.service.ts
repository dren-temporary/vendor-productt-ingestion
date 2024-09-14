import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductDocument, Variant } from './schemas/product.schema';
import { VendorDocument } from './schemas/vendor.schema';
import { ManufacturerDocument } from './schemas/manufacturer.schema';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'fast-csv';
import { nanoid } from 'nanoid';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';

@Injectable()
export class ProductIngestionService implements OnModuleInit {
  private readonly logger = new Logger(ProductIngestionService.name);
  private readonly vendorFilePath: string;
  private readonly chunkSize = 2000;
  private openai: OpenAI;
  constructor(
    @InjectModel('Product') private productModel: Model<ProductDocument>,
    @InjectModel('Vendor') private vendorModel: Model<VendorDocument>,
    @InjectModel('Manufacturer')
    private manufacturerModel: Model<ManufacturerDocument>,
    private configService: ConfigService,
  ) {
    this.vendorFilePath = this.configService.get<string>('VENDOR_FILE_PATH');
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async onModuleInit() {
    try {
      await this.importProducts();
      this.logger.log('Products have been imported succesfully');
    } catch (error) {
      this.logger.error('Error import', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron() {
    try {
      await this.importProducts();

      this.logger.log('Scheduler has finished importing products');

      //await this.enhanceProductDescriptions();
    } catch (error) {
      this.logger.error('Error', error);
    }
  }

  private async importProducts(): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(path.resolve(this.vendorFilePath));
      const csvStream = csv.parse({
        headers: true,
        delimiter: '\t',
        ignoreEmpty: true,
        trim: true,
        quote: '"',
        escape: '\\',
      });

      let chunk: any[] = [];
      csvStream
        .on('data', async (row) => {
          chunk.push(row);

          if (chunk.length >= this.chunkSize) {
            csvStream.pause();
            await this.processChunk(chunk);
            chunk = [];
            csvStream.resume();
          }
        })
        .on('end', async () => {
          if (chunk.length > 0) {
            await this.processChunk(chunk);
          }
          resolve();
        })
        .on('error', (error) => {
          this.logger.error('Error parsing CSV:', error);
          reject(error);
        });

      stream.pipe(csvStream);
    });
  }

  private async processChunk(chunk: any[]): Promise<void> {
    const bulkOps: any[] = [];

    const productIds = new Set<string>();
    for (const row of chunk) {
      if (row['ProductID']) {
        productIds.add(row['ProductID']);
      } else {
        this.logger.warn('product ID is missing =>', row);
      }
    }

    const existingProducts = await this.productModel
      .find({
        productID: { $in: Array.from(productIds) },
      })
      .exec();

    const existingProductsMap = new Map<string, any>();
    existingProducts.forEach((product) => {
      existingProductsMap.set(product.productID, product.toObject());
    });

    for (const row of chunk) {
      if (!row['ProductID']) {
        continue;
      }

      try {
        const productID = row['ProductID'];
        const manufacturerId = await this.ensureManufacturer(
          row['ManufacturerID'],
          row['ManufacturerName'],
        );
        const vendorId = await this.checkVendor(row['SiteSource']);

        const variant = this.createVariant(row);

        if (existingProductsMap.has(productID)) {
          const existingProduct = existingProductsMap.get(productID);
          const variantIndex = existingProduct.variants.findIndex(
            (v: Variant) => v.sku === variant.sku,
          );

          if (variantIndex !== -1) {
            const isVariantUpdated = this.hasVariantDataChanged(
              existingProduct.variants[variantIndex],
              variant,
            );

            if (isVariantUpdated) {
              existingProduct.variants[variantIndex] = variant;
            }
          } else {
            existingProduct.variants.push(variant);
          }
        } else {
          const productDoc = {
            docID: nanoid(),
            productID: productID,
            name: row['ProductName'],
            description: row['ProductDescription'] || '',
            vendorId: vendorId,
            manufacturerId: manufacturerId,
            storefrontPriceVisibility: 'members-only',
            variants: [variant],
            options: this.generateOptions(row),
            availability: row['Availability'] || 'available',
            isFragile: false,
            published: 'published',
            isTaxable: true,
            images: this.parseImages(row),
            categoryId: 'U8YOybu1vbgQdbhSkrpmAYIV',
            dataPublic: {},
            immutable: false,
            deploymentId: 'd8039',
            docType: 'item',
            namespace: 'items',
            companyId: '2yTnVUyG6H9yRX3K1qIFIiRz',
            status: 'active',
            info: {
              transactionId: nanoid(),
              skipEvent: false,
              userRequestId: nanoid(),
            },
          };
          existingProductsMap.set(productID, productDoc);
        }
      } catch (error) {
        this.logger.error(`Error at ${JSON.stringify(row)}`, error);
      }
    }

    for (const [productId, productDoc] of existingProductsMap.entries()) {
      bulkOps.push({
        updateOne: {
          filter: { productID: productId },
          update: { $set: productDoc },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      try {
        await this.productModel.bulkWrite(bulkOps);
      } catch (error) {
        this.logger.error('Error on bulk insertion', error);
        throw error;
      }
    }
  }

  private createVariant(row: any) {
    return {
      id: nanoid(),
      available: this.parseBoolean(row['QuantityOnHand']),
      attributes: {
        packaging: row['PKG'],
        description: row['ItemDescription'],
      },
      cost: this.parseNumber(row['UnitPrice']),
      currency: 'EUR',
      description: row['ItemDescription'],
      manufacturerItemCode: row['ManufacturerItemCode'],
      manufacturerItemId: row['ItemID'],
      packaging: row['PKG'],
      price: this.parseNumber(row['UnitPrice']),
      optionName: `${row['PKG']}, ${row['ItemDescription']}`,
      optionsPath: nanoid(),
      optionItemsPath: nanoid(),
      sku: `${row['ItemID']}${row['ManufacturerItemCode']}${row['PKG']}`,
      active: true,
      images: this.parseImages(row),
      itemCode: row['NDCItemCode'],
    };
  }

  private hasVariantDataChanged(
    existingVariant: any,
    newVariant: any,
  ): boolean {
    return (
      existingVariant.price !== newVariant.price ||
      existingVariant.available !== newVariant.available ||
      existingVariant.description !== newVariant.description
    );
  }

  private generateOptions(row: any) {
    return [
      {
        id: nanoid(),
        name: 'packaging', //DEFAULT
        values: [
          {
            id: nanoid(),
            name: row['PKG'],
            value: row['PKG'],
          },
        ],
      },
      {
        id: nanoid(),
        name: 'description',
        values: [
          {
            id: nanoid(),
            name: row['ItemDescription'],
            value: row['ItemDescription'],
          },
        ],
      },
    ];
  }

  private parseImages(row: any) {
    return row['ItemImageURL']
      ? [
          {
            fileName: row['ImageFileName'] || '',
            cdnLink: row['ItemImageURL'],
            alt: row['ProductName'] || null,
          },
        ]
      : [];
  }

  private async checkVendor(siteSource: string): Promise<string> {
    let vendor = await this.vendorModel.findOne({ name: siteSource }).exec();

    if (!vendor) {
      vendor = new this.vendorModel({
        vendorId: nanoid(),
        siteSource,
        name: siteSource,
      });

      await vendor.save();
    }

    return vendor.vendorId;
  }

  private async ensureManufacturer(
    manufacturerId: string,
    manufacturerName: string,
  ): Promise<string> {
    let manufacturer = await this.manufacturerModel
      .findOne({ manufacturerId })
      .exec();

    if (!manufacturer) {
      manufacturer = new this.manufacturerModel({
        manufacturerId,
        name: manufacturerName,
      });

      await manufacturer.save();
    }

    return manufacturer.manufacturerId;
  }

  private parseNumber(value: string): number | null {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  private parseBoolean(value: string): boolean {
    const parsed = parseFloat(value);
    return !isNaN(parsed) && parsed > 0;
  }
  private async enhanceProductDescriptions(): Promise<void> {
    try {
      const products = await this.productModel.find().limit(10).exec();

      for (const product of products) {
        const enhancedDescription = await this.runDescriptionEnhancementPrompt(
          product.description,
        );

        if (enhancedDescription) {
          product.description = enhancedDescription;
          await product.save();
        }
      }
    } catch (error) {
      this.logger.error('Error during product enhanced', error);
    }
  }

  private async runDescriptionEnhancementPrompt(
    description: string,
  ): Promise<string | null> {
    try {
      const systemMessage = `You are an expert in medical sales. Your specialty is medical consumables used by hospitals on a daily basis. Your task is to enhance the description of a product based on the information provided.`;

      const userMessage = `\nProduct description: ${description}\n\nNew Description:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
      });

      const enhancedDescription = response.choices[0]?.message?.content.trim();

      return enhancedDescription || null;
    } catch (error) {
      this.logger.error('Error running description enhancement prompt:', error);
      return null;
    }
  }
}
