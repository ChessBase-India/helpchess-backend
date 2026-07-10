// node modules
const router = require('express').Router();
const config = require('config');

// controllers
const notesController = require('controllers/notes');

// middlewares
const {
  authenticate,
  authenticateByCookie,
  authenticateByCookieOptional,
  authenticateByCookieInternal,
  authorizeInternalAccess
} = require('middlewares/auth');

const INTERNAL_ACCESS = config.get('internalAccess');
const PERMISSIONS = INTERNAL_ACCESS.permissions;

// routes
router.get('/', (_req, res) => res.send('Hello there!'));

router.get('/healthz', (_req, res) => res.json({ status: 'success' }));

// notes - example resource demonstrating the route -> controller -> service -> model pattern
// and the available auth middlewares. Replace with your own resources.

// public list, optional cookie auth (req.userId is set when logged in)
router
  .route('/v1/notes')
  .get(authenticateByCookieOptional, notesController.getAll)
  // service-to-service token auth
  .post(authenticate, notesController.create);

router
  .route('/v1/notes/:noteId')
  // user cookie auth
  .get(authenticateByCookie, notesController.getById)
  // internal cookie auth + role/permission based authorization
  .patch(
    authenticateByCookieInternal,
    authorizeInternalAccess(PERMISSIONS.notes),
    notesController.patch
  )
  .delete(
    authenticateByCookieInternal,
    authorizeInternalAccess(PERMISSIONS.notes),
    notesController.delete
  );

module.exports = router;
