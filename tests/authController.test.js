const {
  validateRegistration,
  validateProfileEdit,
  validateLoginInput
} = require('../controllers/authController');

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
  } catch (e) {
    console.error(`❌ ${description}`);
    console.error(e);
  }
}

function assertEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Expected "${expected}", but got "${actual}"`);
  }
}

//Register validations

test('validateRegistration - valid input', () => {
  assertEqual(validateRegistration({
    first_name: 'John',
    last_name: 'Doe',
    email: 'user@example.com',
    password: 'secret123',
    confirm_password: 'secret123'
  }), null);
});

test('validateRegistration - invalid email', () => {
  assertEqual(validateRegistration({
    first_name: 'John',
    last_name: 'Doe',
    email: 'userexample.com',
    password: 'secret123',
    confirm_password: 'secret123'
  }), 'Invalid email');
});

test('validateRegistration - empty email', () => {
  assertEqual(validateRegistration({
    first_name: 'John',
    last_name: 'Doe',
    email: '',
    password: 'secret123',
    confirm_password: 'secret123'
  }), 'Invalid email');
});

test('validateRegistration - missing name', () => {
  assertEqual(validateRegistration({
    first_name: '',
    last_name: 'Doe',
    email: 'user@example.com',
    password: 'secret123',
    confirm_password: 'secret123'
  }), 'Name fields required');
});

test('validateRegistration - all fields empty', () => {
  assertEqual(validateRegistration({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: ''
  }), 'Name fields required');
});

test('validateRegistration - short password', () => {
  assertEqual(validateRegistration({
    first_name: 'John',
    last_name: 'Doe',
    email: 'user@example.com',
    password: '123',
    confirm_password: '123'
  }), 'Password too short');
});

test('validateRegistration - passwords do not match', () => {
  assertEqual(validateRegistration({
    first_name: 'John',
    last_name: 'Doe',
    email: 'user@example.com',
    password: 'secret123',
    confirm_password: 'wrong123'
  }), 'Passwords do not match');
});

test('validateRegistration - confirm_password empty', () => {
  assertEqual(validateRegistration({
    first_name: 'John',
    last_name: 'Doe',
    email: 'user@example.com',
    password: 'secret123',
    confirm_password: ''
  }), 'Passwords do not match');
});

//Edit profile validations

test('validateProfileEdit - missing names', () => {
  assertEqual(validateProfileEdit({
    first_name: '',
    last_name: 'Doe',
    password: 'secret123',
    confirm_password: 'secret123'
  }), 'First name and last name are required');
});

test('validateProfileEdit - password too short', () => {
  assertEqual(validateProfileEdit({
    first_name: 'John',
    last_name: 'Doe',
    password: '123',
    confirm_password: '123'
  }), 'New password must be at least 6 characters');
});

test('validateProfileEdit - passwords do not match', () => {
  assertEqual(validateProfileEdit({
    first_name: 'John',
    last_name: 'Doe',
    password: 'secret123',
    confirm_password: 'wrong123'
  }), 'Passwords do not match');
});

test('validateProfileEdit - password provided, confirm_password missing', () => {
  assertEqual(validateProfileEdit({
    first_name: 'John',
    last_name: 'Doe',
    password: 'secret123',
    confirm_password: ''
  }), 'Passwords do not match');
});

test('validateProfileEdit - confirm_password provided, password missing', () => {
  assertEqual(validateProfileEdit({
    first_name: 'John',
    last_name: 'Doe',
    password: '',
    confirm_password: 'secret123'
  }), 'Passwords do not match');
});

test('validateProfileEdit - valid no password change', () => {
  assertEqual(validateProfileEdit({
    first_name: 'John',
    last_name: 'Doe',
    password: '',
    confirm_password: ''
  }), null);
});

test('validateProfileEdit - valid with password change', () => {
  assertEqual(validateProfileEdit({
    first_name: 'John',
    last_name: 'Doe',
    password: 'secret1234',
    confirm_password: 'secret1234'
  }), null);
});

//Login input validations

test('validateLoginInput - valid input', () => {
  assertEqual(validateLoginInput({
    email: 'user@example.com',
    password: 'secret123'
  }), null);
});

test('validateLoginInput - invalid email', () => {
  assertEqual(validateLoginInput({
    email: 'user.example123',
    password: 'secret123'
  }), 'invalid email');
});

test('validateLoginInput - malformed email with spaces', () => {
  assertEqual(validateLoginInput({
    email: ' user @ example.com ',
    password: 'secret123'
  }), 'invalid email');
});

test('validateLoginInput - password too short', () => {
  assertEqual(validateLoginInput({
    email: 'user@example.com',
    password: '123'
  }), 'password too short');
});

test('validateLoginInput - missing email', () => {
  assertEqual(validateLoginInput({
    email: '',
    password: 'secret123'
  }), 'invalid email');
});

test('validateLoginInput - missing password', () => {
  assertEqual(validateLoginInput({
    email: 'user@example.com',
    password: ''
  }), 'password too short');
});
