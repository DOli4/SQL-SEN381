using System;
using System.Collections.Generic;

namespace CampusLearn.Models
{
    public class Student : User
    {
        public List<Module> EnrolledModules { get; } = new List<Module>();
        public List<Topic> SubscribedTopics { get; } = new List<Topic>();
        public List<Tutor> FollowedTutors { get; } = new List<Tutor>();

        public Student(string username, string email, string firstName, string lastName)
            : base(username, email, firstName, lastName) { }

        public void SubscribeTopic(Topic topic)
        {
            if (!SubscribedTopics.Contains(topic))
            {
                SubscribedTopics.Add(topic);
                TopicSubscription.Subscribe(this, topic);
            }
        }

        public void UnsubscribeTopic(Topic topic)
        {
            if (SubscribedTopics.Contains(topic))
            {
                SubscribedTopics.Remove(topic);
                TopicSubscription.Unsubscribe(this, topic);
            }
        }

        public void FollowTutor(Tutor tutor)
        {
            if (!FollowedTutors.Contains(tutor)) FollowedTutors.Add(tutor);
        }

        public void UnfollowTutor(Tutor tutor)
        {
            if (FollowedTutors.Contains(tutor)) FollowedTutors.Remove(tutor);
        }
    }
}
