import jwt from 'jsonwebtoken';

// user: { User_ID, Email, First_Name, Last_Name, RoleName }
export function signUser(user) {
  const name = [user.First_Name, user.Last_Name].filter(Boolean).join(' ').trim();
  return jwt.sign(
    { sub: user.User_ID, email: user.Email, name, role: user.RoleName }, // INT sub
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}
