using System;

namespace RemoteControlServer.Models
{
    // DTO: Data Transfer Object - Gói tin giao tiếp
    public class WebPacket
    {
        public string type { get; set; }      
        public string payload { get; set; }   
        public string command { get; set; }   
        public string param { get; set; }     
    }
}