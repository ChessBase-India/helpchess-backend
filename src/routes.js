// node modules
const router = require('express').Router();
const config = require('config');

// controllers
const notesController = require('controllers/notes');
const authController = require('controllers/auth');
const usersController = require('controllers/users');
const rolesController = require('controllers/roles');

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
router.get('/', (_req, res) => res.send('Your move. ♛'));

router.get('/healthz', (_req, res) => res.json({ status: 'success' }));

// auth
router.post('/v1/login', authController.login);
router.post('/v1/refresh', authController.refresh);
router.get('/v1/me', authenticateByCookie, authController.me);

// roles
router.get(
  '/v1/roles',
  authenticateByCookie,
  authorizeInternalAccess(PERMISSIONS.usersRead),
  rolesController.getAll
);

// users
router
  .route('/v1/users')
  .get(authenticateByCookie, authorizeInternalAccess(PERMISSIONS.usersRead), usersController.getAll)
  .post(
    authenticateByCookie,
    authorizeInternalAccess(PERMISSIONS.usersWrite),
    usersController.create
  );

router.patch(
  '/v1/users/:id',
  authenticateByCookie,
  authorizeInternalAccess(PERMISSIONS.usersWrite),
  usersController.patch
);

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
