using System;
using CampusLearn.Models;
using System.Collections.Generic;

namespace CampusLearn
{
    class Program
    {
        static void Main(string[] args)
        {
            // create roles, users, module, topic, replies, enrol/tutor-student links
            var roleStudent = new Role("student", "Regular student role");
            var roleTutor = new Role("tutor", "Tutor role");
            var roleAdmin = new Role("admin", "Administrator");

            var tutor = new Tutor(
                "tutor1",
                "tutor1@example.com",
                "Tutor",
                "One"
                ) { Role = roleTutor };
            var student = new Student(
                "student1",
                "student1@example.com",
                "Student", "One"
                ) { Role = roleStudent };

            var module = new Module(
                "CS101",
                "Intro to Programming",
                "Basic programming concepts");
            module.EnrolUser(student);
            module.EnrolUser(tutor);

            var topic = module.CreateTopic("How to loop in C#", "I need examples of for and foreach", tutor);

            // Student replies (thread)
            var reply = topic.AddReply(student, "You can use for and foreach. Example: ...");
            var tutorReply = topic.AddReply(tutor, "Good answer. See also LINQ.");

            // Attach content to topic
            var content = new Content("/files/loops.pdf", topicId: topic.TopicId);
            topic.AttachContent(content);

            // Tutor-student mentorship
            var mentorship = TutorStudent.StartMentorship(tutor, student);

            // Subscribe student to topic
            TopicSubscription.Subscribe(student, topic);

            // Upvote and downvote demo
            topic.Upvote();
            reply.Upvote();

            Console.WriteLine($"Module {module.Name} has {module.Topics.Count} topic(s).");
            Console.WriteLine($"Topic '{topic.Title}' created by {topic.Creator.DisplayName} with {topic.Upvotes} upvotes.");
            Console.WriteLine($"Reply by {reply.Author.DisplayName}: {reply.Body}");
            Console.WriteLine($"Mentorship active: {mentorship.IsActive} between {mentorship.Tutor.DisplayName} and {mentorship.Student.DisplayName}");

            Console.WriteLine("Demo complete.");
        }
    }
}