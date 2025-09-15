using System;
using System.Collections.Generic;

namespace CampusLearn.Models
{
    public class Student : User
    {
        public List<Module> EnrolledModules { get; } = new List<Module>();

        // Track what this student subscribed to + notification prefs
        private readonly HashSet<Topic> _subscriptions = new HashSet<Topic>();
        private readonly HashSet<Topic> _notifyOn = new HashSet<Topic>();

        public Student(string username, string email, string firstName, string lastName)
            : base(username, email, firstName, lastName) { }

        // + subscribe()
        public void subscribe(Topic topic)
        {
            if (topic == null) throw new ArgumentNullException(nameof(topic));
            if (_subscriptions.Add(topic))
            {
                topic.AddSubscriber(this); // internal helper on Topic (see below)
            }
        }

        // + unsubscribe()D
        public void unsubscribe(Topic topic)
        {
            if (topic == null) throw new ArgumentNullException(nameof(topic));
            if (_subscriptions.Remove(topic))
            {
                _notifyOn.Remove(topic);
                topic.RemoveSubscriber(this); // internal helper on Topic
            }
        }

        // + enableNoti()
        public void enableNoti(Topic topic)
        {
            if (topic == null) throw new ArgumentNullException(nameof(topic));
            if (!_subscriptions.Contains(topic))
                throw new InvalidOperationException("Subscribe to the topic before enabling notifications.");

            _notifyOn.Add(topic);
        }

        // + disableNoti()
        public void disableNoti(Topic topic)
        {
            if (topic == null) throw new ArgumentNullException(nameof(topic));
            _notifyOn.Remove(topic);
        }

        // (optional convenience)
        public bool IsNotificationsOn(Topic topic) => _notifyOn.Contains(topic);
        public bool IsSubscribed(Topic topic) => _subscriptions.Contains(topic);
    }
}
