from uuid import uuid4

from config.refresh import LEASE_SECONDS


class RedisLocks:
    def __init__(self, redis):
        self.redis = redis

    def acquire(self, key):
        """Acquire an expiring token-owned lock without waiting for a competing worker."""
        token = str(uuid4())
        return token if self.redis.set(key, token, nx=True, ex=LEASE_SECONDS) else None

    def renew(self, key, token):
        """Renew only our lease; never extend a replacement worker's ownership."""
        return bool(
            self.redis.eval(
                "if redis.call('get',KEYS[1])==ARGV[1] then "
                "return redis.call('expire',KEYS[1],ARGV[2]) else return 0 end",
                1,
                key,
                token,
                LEASE_SECONDS,
            )
        )

    def release(self, key, token):
        """Compare-and-delete prevents an expired worker from deleting a newer lock."""
        self.redis.eval(
            "if redis.call('get',KEYS[1])==ARGV[1] then "
            "return redis.call('del',KEYS[1]) else return 0 end",
            1,
            key,
            token,
        )
