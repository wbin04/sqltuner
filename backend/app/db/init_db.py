import asyncio
import sys

from app.core.security import get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.models import User, UserRole
from sqlalchemy import select


async def init_db():
    print("Starting database initialization...")

    if not AsyncSessionLocal:
        print("ERROR: Database is not configured or disabled")
        sys.exit(1)

    async with AsyncSessionLocal() as session:
        try:
            initial_users = [
                {
                    "email": "admin@gmail.com",
                    "password": "admin123",
                    "role": UserRole.ADMIN
                },
                {
                    "email": "quochuy@gmail.com",
                    "password": "quochuy123",
                    "role": UserRole.USER
                }
            ]

            for user_data in initial_users:
                result = await session.execute(
                    select(User).where(User.email == user_data["email"])
                )
                existing_user = result.scalar_one_or_none()

                if existing_user:
                    print(
                        f"✓ User '{user_data['email']}' already exists. "
                        "Skipping."
                    )
                else:
                    hashed_password = get_password_hash(user_data["password"])
                    new_user = User(
                        email=user_data["email"],
                        password=hashed_password,
                        role=user_data["role"]
                    )
                    session.add(new_user)
                    await session.commit()
                    print(
                        f"✓ User '{user_data['email']}' created successfully "
                        f"with role '{user_data['role'].value}'"
                    )

            print("Database initialization completed successfully!")

        except Exception as e:
            print(f"ERROR during database initialization: {str(e)}")
            await session.rollback()
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(init_db())
