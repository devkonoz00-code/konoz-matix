const assert = require('node:assert/strict');

// Keep this smoke suite self-contained and prevent it from using real secrets,
// databases, or Cloudinary accounts from a developer's .env file.
process.env.NODE_ENV = 'development';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/matix-cloudinary-test-not-connected';
process.env.JWT_SECRET = 'cloudinary-image-test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'cloudinary-image-test-refresh-secret';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.CLOUDINARY_URL = '';

const Item = require('./src/models/Item');
const auditService = require('./src/services/auditService');
const logger = require('./src/utils/logger');
const cloudinaryService = require('./src/services/cloudinaryService');
const itemService = require('./src/services/itemService');
const itemRoutes = require('./src/routes/itemRoutes');
const itemController = require('./src/controllers/itemController');

const CLOUD_NAME = 'demo-cloud';
const OLD_PUBLIC_ID = 'matix/items/11111111-1111-4111-8111-111111111111';
const NEW_PUBLIC_ID = 'matix/items/22222222-2222-4222-8222-222222222222';
const OLD_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v1/${OLD_PUBLIC_ID}.jpg`;
const NEW_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v2/${NEW_PUBLIC_ID}.webp`;

let passed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`  PASS ${name}`);
    });
}

function makeItem({ imageUrl = null, imagePublicId = null, version = 4 } = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    __v: version,
    imageUrl,
    imagePublicId,
    isActive: true,
    toJSON() {
      return {
        _id: this._id,
        __v: this.__v,
        imageUrl: this.imageUrl,
        imagePublicId: this.imagePublicId,
        isActive: this.isActive,
      };
    },
  };
}

function selectable(value, error) {
  return {
    async select() {
      if (error) throw error;
      return value;
    },
  };
}

async function run() {
  const {
    resolveCloudinaryConfiguration,
    buildUploadOptions,
    executeUploadStream,
    normalizeCloudinaryUploadError,
    parseItemImageReferenceForCloud,
  } = cloudinaryService.__testing;

  await test('requires a complete Cloudinary configuration', () => {
    const missing = resolveCloudinaryConfiguration({});
    const partial = resolveCloudinaryConfiguration({ CLOUDINARY_CLOUD_NAME: 'demo' });
    assert.equal(missing.configured, false);
    assert.equal(missing.code, 'CLOUDINARY_NOT_CONFIGURED');
    assert.equal(partial.configured, false);
    assert.equal(partial.code, 'CLOUDINARY_INVALID_CONFIGURATION');
  });

  await test('accepts trimmed explicit credentials or CLOUDINARY_URL', () => {
    const explicit = resolveCloudinaryConfiguration({
      CLOUDINARY_CLOUD_NAME: ' demo-cloud ',
      CLOUDINARY_API_KEY: ' key ',
      CLOUDINARY_API_SECRET: ' secret ',
    });
    const url = resolveCloudinaryConfiguration({
      CLOUDINARY_URL: 'cloudinary://api-key:api-secret@url-cloud',
    });
    assert.equal(explicit.configured, true);
    assert.equal(explicit.cloudName, 'demo-cloud');
    assert.equal(url.configured, true);
    assert.equal(url.cloudName, 'url-cloud');
    assert.equal(resolveCloudinaryConfiguration({ CLOUDINARY_URL: 'https://example.com' }).configured, false);
  });

  await test('rejects conflicting URL and explicit Cloudinary credentials', () => {
    const conflict = resolveCloudinaryConfiguration({
      CLOUDINARY_CLOUD_NAME: 'explicit-cloud',
      CLOUDINARY_API_KEY: 'explicit-key',
      CLOUDINARY_API_SECRET: 'explicit-secret',
      CLOUDINARY_URL: 'cloudinary://url-key:url-secret@url-cloud',
    });
    const matching = resolveCloudinaryConfiguration({
      CLOUDINARY_CLOUD_NAME: 'same-cloud',
      CLOUDINARY_API_KEY: 'same-key',
      CLOUDINARY_API_SECRET: 'same-secret',
      CLOUDINARY_URL: 'cloudinary://same-key:same-secret@same-cloud',
    });

    assert.equal(conflict.configured, false);
    assert.equal(conflict.code, 'CLOUDINARY_CONFLICTING_CONFIGURATION');
    assert.equal(matching.configured, true);
    assert.equal(matching.source, 'explicit+url');
  });

  await test('uses the Cloudinary v2 stream signature with an explicit bounded timeout', async () => {
    let capturedOptions;
    let capturedBuffer;
    const fakeUploader = {
      upload_stream(options, callback) {
        capturedOptions = options;
        assert.equal(typeof callback, 'function');
        return {
          once() { return this; },
          end(buffer) {
            capturedBuffer = buffer;
            callback(null, { secure_url: NEW_URL, public_id: NEW_PUBLIC_ID });
          },
        };
      },
    };

    const options = buildUploadOptions({ folder: cloudinaryService.ITEM_IMAGE_FOLDER });
    const result = await executeUploadStream(fakeUploader, Buffer.from('image'), options);
    assert.equal(capturedOptions.timeout, cloudinaryService.DEFAULT_UPLOAD_TIMEOUT_MS);
    assert.equal(capturedOptions.folder, cloudinaryService.ITEM_IMAGE_FOLDER);
    assert.equal(capturedBuffer.toString(), 'image');
    assert.equal(result.public_id, NEW_PUBLIC_ID);
    assert.equal(buildUploadOptions({ timeout: 1 }).timeout, 5_000);
    assert.equal(buildUploadOptions({ timeout: 999_999 }).timeout, 120_000);
  });

  await test('classifies Cloudinary auth, timeout, and network failures without leaking credentials', () => {
    const auth = normalizeCloudinaryUploadError({
      http_code: 401,
      message: 'Unknown API key in cloudinary://key:secret@demo-cloud',
    });
    const timeout = normalizeCloudinaryUploadError({
      http_code: 499,
      name: 'TimeoutError',
      message: 'Request Timeout',
    });
    const network = normalizeCloudinaryUploadError({
      code: 'EAI_AGAIN',
      message: 'DNS lookup failed',
    });

    assert.equal(auth.code, 'CLOUDINARY_AUTH_FAILED');
    assert.equal(auth.statusCode, 503);
    assert(!auth.providerMessage.includes('key:secret'));
    assert.equal(timeout.code, 'CLOUDINARY_UPLOAD_TIMEOUT');
    assert.equal(timeout.statusCode, 504);
    assert.equal(network.code, 'CLOUDINARY_UNAVAILABLE');
    assert.equal(network.statusCode, 502);
  });

  await test('validates product image URLs against cloud, folder, and public ID', () => {
    const reference = parseItemImageReferenceForCloud(`http://res.cloudinary.com/${CLOUD_NAME}/image/upload/v2/${NEW_PUBLIC_ID}.webp`, NEW_PUBLIC_ID, CLOUD_NAME);
    assert.equal(reference.url, NEW_URL);
    assert.equal(reference.publicId, NEW_PUBLIC_ID);
    assert.equal(parseItemImageReferenceForCloud(NEW_URL, OLD_PUBLIC_ID, CLOUD_NAME), null);
    assert.equal(parseItemImageReferenceForCloud(NEW_URL, NEW_PUBLIC_ID, 'other-cloud'), null);
    assert.equal(parseItemImageReferenceForCloud('/uploads/legacy.jpg', undefined, CLOUD_NAME), null);
    assert.equal(cloudinaryService.isManagedItemPublicId('../matix/items/unsafe'), false);
  });

  await test('refuses product uploads instead of falling back to local storage', async () => {
    await assert.rejects(
      cloudinaryService.uploadBuffer(Buffer.from('not-uploaded')),
      error => error.statusCode === 503 && error.code === 'CLOUDINARY_NOT_CONFIGURED'
    );
  });

  await test('keeps imagePublicId internal by default', () => {
    assert.equal(Item.schema.path('imagePublicId').options.select, false);
  });

  await test('exposes only atomic product image mutation routes', () => {
    const routeMethods = itemRoutes.stack
      .filter(layer => layer.route)
      .map(layer => ({ path: layer.route.path, methods: layer.route.methods }));
    assert(routeMethods.some(route => route.path === '/:id/image' && route.methods.put));
    assert(routeMethods.some(route => route.path === '/:id/image' && route.methods.delete));
    assert(!routeMethods.some(route => route.path === '/upload-image'));
  });

  await test('returns a clear endpoint error when Cloudinary is absent', async () => {
    let nextError;
    await itemController.replaceImage(
      {
        params: { id: '507f1f77bcf86cd799439011' },
        file: {
          mimetype: 'image/jpeg',
          buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        },
      },
      {},
      error => { nextError = error; }
    );
    assert.equal(nextError.statusCode, 503);
    assert.equal(nextError.code, 'CLOUDINARY_NOT_CONFIGURED');
  });

  const originals = {
    findById: Item.findById,
    findOneAndUpdate: Item.findOneAndUpdate,
    auditLog: auditService.log,
    loggerError: logger.error,
    getById: itemService.getById,
    isConfigured: cloudinaryService.isCloudinaryConfigured,
    uploadBuffer: cloudinaryService.uploadBuffer,
    parseReference: cloudinaryService.parseItemImageReference,
    deleteItemImage: cloudinaryService.deleteItemImage,
  };

  const events = [];
  const request = { user: { _id: '507f191e810c19729de860ea', role: 'ADMIN' }, headers: {} };

  try {
    cloudinaryService.isCloudinaryConfigured = () => true;
    cloudinaryService.parseItemImageReference = (url, publicId) => (
      parseItemImageReferenceForCloud(url, publicId, CLOUD_NAME)
    );
    cloudinaryService.uploadBuffer = async () => {
      events.push('upload-new');
      return { secure_url: NEW_URL, public_id: NEW_PUBLIC_ID };
    };
    cloudinaryService.deleteItemImage = async publicId => {
      events.push(`delete:${publicId}`);
      return { result: 'ok' };
    };
    auditService.log = async () => {
      events.push('audit');
    };
    itemService.getById = async id => ({ _id: id, imageUrl: NEW_URL });

    await test('preserves a classified Cloudinary auth failure through itemService', async () => {
      events.length = 0;
      const oldItem = makeItem({ imageUrl: OLD_URL, imagePublicId: OLD_PUBLIC_ID });
      Item.findById = () => selectable(oldItem);
      logger.error = (_message, diagnostic) => {
        events.push(`log:${diagnostic.code}`);
      };
      cloudinaryService.uploadBuffer = async () => {
        throw normalizeCloudinaryUploadError({
          http_code: 401,
          message: 'Invalid Signature',
        });
      };

      await assert.rejects(
        itemService.replaceImage(oldItem._id, { buffer: Buffer.from('image') }, request),
        error => error.statusCode === 503 && error.code === 'CLOUDINARY_AUTH_FAILED'
      );
      assert.deepEqual(events, ['log:CLOUDINARY_AUTH_FAILED']);

      logger.error = originals.loggerError;
      cloudinaryService.uploadBuffer = async () => {
        events.push('upload-new');
        return { secure_url: NEW_URL, public_id: NEW_PUBLIC_ID };
      };
    });

    await test('replaces with CAS, audits, then deletes the saved old Cloudinary image', async () => {
      events.length = 0;
      const oldItem = makeItem({ imageUrl: OLD_URL, imagePublicId: OLD_PUBLIC_ID, version: 7 });
      const updatedItem = makeItem({ imageUrl: NEW_URL, imagePublicId: NEW_PUBLIC_ID, version: 8 });
      let capturedFilter;
      let capturedUpdate;

      Item.findById = () => selectable(oldItem);
      Item.findOneAndUpdate = (filter, update) => {
        events.push('database-cas');
        capturedFilter = filter;
        capturedUpdate = update;
        return selectable(updatedItem);
      };

      await itemService.replaceImage(oldItem._id, { buffer: Buffer.from('image') }, request);
      assert.equal(capturedFilter.__v, 7);
      assert.equal(capturedUpdate.$inc.__v, 1);
      assert.deepEqual(events, [
        'upload-new',
        'database-cas',
        'audit',
        `delete:${OLD_PUBLIC_ID}`,
      ]);
    });

    await test('still cleans the old image if auditing fails after the database commit', async () => {
      events.length = 0;
      const oldItem = makeItem({ imageUrl: OLD_URL, imagePublicId: OLD_PUBLIC_ID, version: 7 });
      const updatedItem = makeItem({ imageUrl: NEW_URL, imagePublicId: NEW_PUBLIC_ID, version: 8 });
      Item.findById = () => selectable(oldItem);
      Item.findOneAndUpdate = () => {
        events.push('database-cas');
        return selectable(updatedItem);
      };
      auditService.log = async () => {
        events.push('audit');
        throw new Error('audit unavailable');
      };

      await assert.rejects(
        itemService.replaceImage(oldItem._id, { buffer: Buffer.from('image') }, request),
        /audit unavailable/
      );
      assert.deepEqual(events, [
        'upload-new',
        'database-cas',
        'audit',
        `delete:${OLD_PUBLIC_ID}`,
      ]);
      auditService.log = async () => {
        events.push('audit');
      };
    });

    await test('deletes the new image on a concurrent update conflict', async () => {
      events.length = 0;
      const oldItem = makeItem({ imageUrl: OLD_URL, imagePublicId: OLD_PUBLIC_ID });
      Item.findById = () => selectable(oldItem);
      Item.findOneAndUpdate = () => {
        events.push('database-cas');
        return selectable(null);
      };

      await assert.rejects(
        itemService.replaceImage(oldItem._id, { buffer: Buffer.from('image') }, request),
        error => error.statusCode === 409 && error.code === 'ITEM_IMAGE_CONFLICT'
      );
      assert.deepEqual(events, ['upload-new', 'database-cas', `delete:${NEW_PUBLIC_ID}`]);
    });

    await test('cleans a new resource when Cloudinary returns malformed metadata', async () => {
      events.length = 0;
      const oldItem = makeItem({ imageUrl: OLD_URL, imagePublicId: OLD_PUBLIC_ID });
      Item.findById = () => selectable(oldItem);
      cloudinaryService.uploadBuffer = async () => ({
        secure_url: 'https://example.com/not-managed.jpg',
        public_id: NEW_PUBLIC_ID,
      });

      await assert.rejects(
        itemService.replaceImage(oldItem._id, { buffer: Buffer.from('image') }, request),
        error => error.statusCode === 502 && error.code === 'INVALID_STORAGE_RESPONSE'
      );
      assert.deepEqual(events, [`delete:${NEW_PUBLIC_ID}`]);

      cloudinaryService.uploadBuffer = async () => {
        events.push('upload-new');
        return { secure_url: NEW_URL, public_id: NEW_PUBLIC_ID };
      };
    });

    await test('removes a legacy local URL without attempting Cloudinary deletion', async () => {
      events.length = 0;
      // Even a stale public ID must not make a local legacy URL deletable.
      const localItem = makeItem({ imageUrl: '/uploads/legacy.jpg', imagePublicId: OLD_PUBLIC_ID });
      const updatedItem = makeItem({ imageUrl: null, imagePublicId: null, version: 5 });
      cloudinaryService.isCloudinaryConfigured = () => false;
      Item.findById = () => selectable(localItem);
      Item.findOneAndUpdate = () => {
        events.push('database-cas');
        return selectable(updatedItem);
      };

      await itemService.removeImage(localItem._id, request);
      assert.deepEqual(events, ['database-cas', 'audit']);
      cloudinaryService.isCloudinaryConfigured = () => true;
    });

    await test('still cleans a removed Cloudinary image if auditing fails', async () => {
      events.length = 0;
      const oldItem = makeItem({ imageUrl: OLD_URL, imagePublicId: OLD_PUBLIC_ID, version: 4 });
      const updatedItem = makeItem({ imageUrl: null, imagePublicId: null, version: 5 });
      Item.findById = () => selectable(oldItem);
      Item.findOneAndUpdate = () => {
        events.push('database-cas');
        return selectable(updatedItem);
      };
      auditService.log = async () => {
        events.push('audit');
        throw new Error('audit unavailable');
      };

      await assert.rejects(itemService.removeImage(oldItem._id, request), /audit unavailable/);
      assert.deepEqual(events, ['database-cas', 'audit', `delete:${OLD_PUBLIC_ID}`]);
      auditService.log = async () => {
        events.push('audit');
      };
    });

    await test('blocks direct image mutation through the general item update', async () => {
      await assert.rejects(
        itemService.update('507f1f77bcf86cd799439011', { imageUrl: NEW_URL }, request),
        error => error.statusCode === 400 && error.code === 'IMAGE_ENDPOINT_REQUIRED'
      );
    });

    await test('blocks non-admin activation changes in the service layer', async () => {
      const item = makeItem();
      let saved = false;
      item.save = async () => { saved = true; };
      Item.findById = async () => item;

      await assert.rejects(
        itemService.update(item._id, { isActive: false }, { user: { role: 'WAREHOUSE_MANAGER' } }),
        error => error.statusCode === 403 && error.code === 'FORBIDDEN'
      );
      assert.equal(saved, false);
    });
  } finally {
    Item.findById = originals.findById;
    Item.findOneAndUpdate = originals.findOneAndUpdate;
    auditService.log = originals.auditLog;
    logger.error = originals.loggerError;
    itemService.getById = originals.getById;
    cloudinaryService.isCloudinaryConfigured = originals.isConfigured;
    cloudinaryService.uploadBuffer = originals.uploadBuffer;
    cloudinaryService.parseItemImageReference = originals.parseReference;
    cloudinaryService.deleteItemImage = originals.deleteItemImage;
  }

  console.log(`Cloudinary product image checks passed: ${passed}`);
}

run().catch(error => {
  console.error('Cloudinary product image checks failed:', error.message);
  process.exitCode = 1;
});
