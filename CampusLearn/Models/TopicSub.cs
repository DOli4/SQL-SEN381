using System;
using System.Collections.Generic;

namespace CampusLearn.Models
{
    public class TopicSubscription
    {
        private static readonly List<TopicSubscription> _subs = new List<TopicSubscription>();

        public Guid SubscriptionId { get; private set; }
        public Topic Topic { get; private set; }
        public User User { get; private set; }
        public DateTime SubscribedOn { get; private set; }

        private TopicSubscription(User user, Topic topic)
        {
            SubscriptionId = Guid.NewGuid();
            User = user;
            Topic = topic;
            SubscribedOn = DateTime.UtcNow;
        }

        public static TopicSubscription Subscribe(User user, Topic topic)
        {
            if (user == null) throw new ArgumentNullException(nameof(user));
            if (topic == null) throw new ArgumentNullException(nameof(topic));

            var exists = _subs.Find(s => s.User.UserId == user.UserId && s.Topic.TopicId == topic.TopicId);
            if (exists != null) return exists;

            var sub = new TopicSubscription(user, topic);
            _subs.Add(sub);
            return sub;
        }

        public static bool Unsubscribe(User user, Topic topic)
        {
            var found = _subs.Find(s => s.User.UserId == user.UserId && s.Topic.TopicId == topic.TopicId);
            if (found != null) return _subs.Remove(found);
            return false;
        }

        public static IEnumerable<TopicSubscription> AllSubscriptions() => _subs.AsReadOnly();
    }
}
